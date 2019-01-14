import * as _ from 'lodash';
import * as fs from 'fs';
import * as jsonpath from 'jsonpath';
import * as Promise from 'bluebird';
import * as stdin from 'get-stdin';
import * as yaml from 'js-yaml';

const readFileContent = Promise.promisify(fs.readFile);

export const getConfig = Promise.method((file: string | '-') => {
  if (file === '-') {
    return stdin();
  }

  if (!fs.existsSync(file)) {
    throw new Error('File not found');
  }

  return readFileContent(file).then(content => {
    return content.toString();
  });
});

export interface IngressConfig {
  version: string;
  ingress: {
    port: number;
    mode: 'tcp' | 'tls' | 'http' | 'https';
    tls: {
      sni: string;
      cert: string;
    };
    target: {
      host: string;
      port: number;
      options: string[];
    }[];
  }[];

  certificates: {
    [provider: string]:
      | SelfSignedCertificateProvider
      | StaticCertificateProvider
      | LetsEncryptCertificateProvider;
  };
}

export interface CertificateProviderBase {
  domains: string[];
}

export interface SelfSignedCertificateProvider extends CertificateProviderBase {
  self_signed: any;
}

export interface StaticCertificateProvider extends CertificateProviderBase {
  static: {
    key: string;
    cert: string;
  };
}

export interface LetsEncryptCertificateProvider
  extends CertificateProviderBase {
  letsencrypt: {
    email: string;
    server?: string;
  };
}

export const parseConfig = Promise.method((config: string) => {
  const ingress: IngressConfig = yaml.safeLoad(config);

  if (ingress == null) {
    throw new Error('Invalid YAML');
  }

  return ingress;
});

export const queryConfig = (
  config: IngressConfig,
  path: string,
  count?: number
) => {
  const results = queryObject(config, path);

  if (count === undefined) {
    return results;
  }

  if (count > 1) {
    return _.take(results, count);
  } else if (count == 1 && results.length >= 1) {
    return results[0];
  }
};

const queryObject = (obj: any, path: string) => {
  return jsonpath.query(obj, path);
};
