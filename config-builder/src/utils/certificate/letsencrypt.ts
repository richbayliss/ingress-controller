import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import { CertificateConfig, DynamicCertificateFactoryBase } from './base';
import { writeToFile } from '../file';
import * as express from 'express';
import * as process from 'process';
import { logger } from '../logger';
import { LetsEncryptCertificateProvider } from '../../../../ingress-controller-parser/lib';

const log = logger('CertAgent');

export const GREENLOCK_UNIX_SOCKET =
  process.env.UNIX_SOCKET || '/var/run/greenlock.sock';

const GREENLOCK_DEBUG = process.env.DEBUG || '';

const unlink = Promise.promisify(fs.unlink).bind(fs);

interface LetsEncryptAgentOptions {
  configDir: string;
}

interface LetsEncryptResult {
  privkey: string;
  cert: string;
  chain: string;
}

const getLetsEncryptAgent = _.once((opts: LetsEncryptAgentOptions) => {
  const greenlock = require('greenlock').create({
    agreeTos: true,
    configDir: path.join(opts.configDir, 'letsencrypt'),
    securityUpdates: false,
    debug: GREENLOCK_DEBUG === '*' || GREENLOCK_DEBUG.indexOf('greenlock') >= 0
  });

  const app = express();

  app.get('/ping', (_req, res) => {
    res.status(200).send('PONG');
  });

  app.use('/', greenlock.middleware());

  return unlink(GREENLOCK_UNIX_SOCKET)
    .catch(_.noop)
    .then(() => {
      app.listen(GREENLOCK_UNIX_SOCKET);
      return greenlock;
    });
});

export class LetsEncryptCertificateFactory extends DynamicCertificateFactoryBase {
  config?: CertificateConfig;
  pemPath?: string;
  provider: LetsEncryptCertificateProvider;

  constructor(name: string, provider: LetsEncryptCertificateProvider) {
    super(name, provider);
    this.provider = provider;
  }

  private registerCertifcate(): Promise<LetsEncryptResult> {
    return getLetsEncryptAgent({
      configDir: this.config.certsDir
    }).then(agent => {
      return agent.register({
        domains: this.provider.domains,
        email: this.provider.letsencrypt.email,
        agreeTos: true, // set to tosUrl string (or true) to pre-approve (and skip agreeToTerms)
        rsaKeySize: 2048, // 2048 or higher
        server:
          this.provider.letsencrypt.server ||
          'https://acme-v02.api.letsencrypt.org/directory',
        challengeType: 'http-01' // http-01, tls-sni-01, or dns-01
      });
    });
  }

  configure(config: CertificateConfig): Promise<void> {
    this.config = config;
    this.pemPath = path.join(this.config.certsDir, `${this.name}.pem`);

    return Promise.resolve();
  }

  intialise = Promise.method(() => {
    if (this.config == null) {
      throw new Error('Unable to initialise. Configuration is bad or missing.');
    }

    // configure renewal to happen every 24 hours...
    setInterval(this.renew, 86400 * 1000);

    // renew now, to make sure we have a certificate to use...
    return this.renew();
  });

  renew = Promise.method(() => {
    return this.readPemFile(this.pemPath)
      .then(pem => {
        if (pem === '') {
          return this.createTemporaryCertificate(this.pemPath).then(() => {
            return pem;
          });
        }

        return pem;
      })
      .tap(_ => this.ready())
      .then(pem => {
        return Promise.delay(10000)
          .then(() => this.registerCertifcate())
          .then(results => {
            const issuedPem = [
              results.cert,
              results.privkey,
              results.chain
            ].join('\r\n');

            if (pem !== issuedPem) {
              return writeToFile(this.pemPath, issuedPem).then(() => {
                this.didChange();
              });
            }
          })
          .catch(err => {
            log.error(`Unable to verify certificate for ${this.name}`, err);
          });
      });
  });
}
