import * as Promise from 'bluebird';
import { IngressConfig } from 'ingress-controller-parser';
import * as _ from 'lodash';
import * as uuid from 'uuid';
import { GREENLOCK_UNIX_SOCKET } from './certificate/letsencrypt';
import { startConfigFile, ConfigFile } from './config-file';

const newUuid = () => uuid.v4().replace(/\-/g, '');
interface FrontendCollection {
  [name: string]: Frontend;
}

class Frontend {
  name: string;
  binds: {
    address: string;
  }[];
  certificates: string[];
  backends: BackendCollection;
  hosts: { host: string; backend: string }[];
  public defaultBackend?: Backend;
  mode: 'tcp' | 'http';

  constructor(name: string) {
    this.name = name;
    this.binds = [];
    this.certificates = [];
    this.backends = {};
    this.hosts = [];
    this.defaultBackend = null;
    this.mode = 'tcp';
  }

  public addBind(address: string) {
    if (!_.find(this.binds, b => b.address === address)) {
      this.binds.push({
        address
      });
    }
  }

  public addCertificate(path: string) {
    if (this.certificates.find(p => p === path)) {
      return;
    }

    this.certificates.push(path);
  }

  public useBackend(backend: Backend) {
    if (this.backends[backend.name] == null) {
      this.backends[backend.name] = backend;
    }
  }

  public addHost(host: string, backend: string) {
    this.hosts.push({ host, backend });
  }

  public buildSection = (file: ConfigFile) => {
    file.addLine(`frontend ${this.name}`).startIndent();

    const certificates =
      this.certificates.length > 0
        ? `ssl crt ${this.certificates.join(' ')}`
        : '';

    _.each(this.binds, bind => {
      file.addLine(`bind ${bind.address} ${certificates}`);
    });

    file.addLine(`mode ${this.mode}`);
    const options: string[] = [];

    if (this.mode === 'http') {
      options.push('option forwardfor');

      if (certificates !== '') {
        options.push('reqadd X-Forwarded-Proto:\\ https');
      }
    }

    if (this.mode === 'tcp') {
      options.push('tcp-request inspect-delay 5s');
      options.push('tcp-request content accept if { req.ssl_hello_type 1 }');
    }
    file.addLines(options);

    if (this.hosts.length > 0) {
      _.each(this.hosts, host => {
        const acl = (hostname: string) => {
          if (this.mode === 'http') {
            return `hdr_dom(host) -m end "${hostname}"`;
          } else {
            return `req.ssl_sni -m end "${hostname}"`;
          }
        };

        file.addLine(`use_backend ${host.backend} if { ${acl(host.host)} }`);
      });
    }

    if (this.defaultBackend !== null) {
      file.addLine(`default_backend ${this.defaultBackend.name}`);
    }

    const backends = _.chain(this.backends)
      .map(backend => {
        return backend;
      })
      .value();

    if (this.defaultBackend !== null) {
      backends.push(this.defaultBackend);
    }

    _.each(backends, backend => {
      backend.buildConfig(file);
      file
        .startIndent()
        .addLine(`mode ${this.mode}`)
        .endIndent();
    });

    file.endIndent();
  };
}

interface BackendCollection {
  [name: string]: Backend;
}

class Backend {
  name: string;
  targets: string[];

  constructor(name: string, targets?: string[]) {
    this.name = name;
    this.targets = targets || [];
  }

  public buildConfig = (file: ConfigFile) => {
    file.addLine(`backend ${this.name}`).startIndent();

    file.addLine('balance roundrobin');
    let count = 0;
    _.each(this.targets, target => {
      file.addLine(`server SRV_${count++} ${target}`);
    });
    file.endIndent();
  };
}

const buildGlobal = Promise.method(
  (config: IngressConfig, file: ConfigFile) => {
    file
      .addLine('global')
      .startIndent()
      .addLines(['log /dev/log local0', 'tune.ssl.default-dh-param 1024'])
      .endIndent();
  }
);

const buildDefaults = Promise.method(
  (config: IngressConfig, file: ConfigFile) => {
    file
      .addLine('defaults')
      .startIndent()
      .addLines([
        'log global',
        'timeout connect 5000',
        'timeout client 50000',
        'timeout server 50000',
        'mode http',
        'option httplog',
        'option forwardfor'
      ])
      .endIndent();
  }
);

const buildFrontend = Promise.method(
  (config: IngressConfig, file: ConfigFile) => {
    const frontends: FrontendCollection = {};

    // we need to check if we have a 'letsencrypt' certificate provider defined, as we may be doing HTTP validation...
    _.each(config.certificates, provider => {
      if ('letsencrypt' in provider) {
        const frontendName = 'frontend_letsencrypt';
        const frontend = new Frontend(frontendName);
        frontend.mode = 'http';
        frontend.addBind('*:80');
        frontend.defaultBackend = new Backend('backend_letsencrypt', [
          GREENLOCK_UNIX_SOCKET
        ]);
        frontends[frontendName] = frontend;
      }
    });

    _.each(config.ingress, ingress => {
      const frontendName = `frontend_${ingress.port}`;
      const frontend = frontends[frontendName] || new Frontend(frontendName);

      frontend.addBind(`*:${ingress.port}`);

      const id = newUuid();
      if (ingress.mode === 'https' || ingress.mode === 'tls') {
        frontend.addCertificate(`/usr/src/app/certs/${ingress.tls.cert}.pem`);
      }

      if (ingress.mode === 'http' || ingress.mode === 'https') {
        frontend.mode = 'http';
      }

      const backend = new Backend(
        `backend_${id}`,
        _.map(ingress.target, target => {
          const options = target.options ? target.options.join(' ') : '';
          return `${target.host}:${target.port} ${options}`;
        })
      );

      if (ingress.tls && ingress.tls.sni) {
        frontend.addHost(ingress.tls.sni, `backend_${id}`);
        frontend.useBackend(backend);
      } else {
        frontend.defaultBackend = backend;
      }

      frontends[frontendName] = frontend;
    });

    _.each(frontends, frontend => {
      frontend.buildSection(file);
    });
  }
);

export const buildProxyConfig = Promise.method((config: IngressConfig) => {
  return startConfigFile().then(file => {
    return Promise.all([
      buildGlobal(config, file),
      buildDefaults(config, file),
      buildFrontend(config, file)
    ]).then(() => file.content());
  });
});
