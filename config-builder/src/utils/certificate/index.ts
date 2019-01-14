import * as Promise from 'bluebird';
import * as _ from 'lodash';

import { StaticCertificateFactory } from './static';
import { SelfSignedCertificateFactory } from './self_signed';
import {
  CertificateFactory,
  CertificateConfig,
  CertificateFactoryBase
} from './base';
import { LetsEncryptCertificateFactory } from './letsencrypt';
import {
  StaticCertificateProvider,
  SelfSignedCertificateProvider,
  LetsEncryptCertificateProvider,
  IngressConfig
} from '../../../../ingress-controller-parser/lib';

export const getFactory = (
  name: string,
  provider:
    | StaticCertificateProvider
    | SelfSignedCertificateProvider
    | LetsEncryptCertificateProvider
): CertificateFactoryBase => {
  if ('static' in provider) {
    return new StaticCertificateFactory(name, provider);
  }

  if ('self_signed' in provider) {
    return new SelfSignedCertificateFactory(name, provider);
  }

  if ('letsencrypt' in provider) {
    return new LetsEncryptCertificateFactory(name, provider);
  }

  throw new Error('No valid certificate factory can be found');
};

export const configureCertificateFactories = Promise.method(
  (config: IngressConfig, certsDir: string) => {
    return Promise.all(
      _.chain(config.certificates)
        .map((provider, name) => {
          const config: CertificateConfig = {
            domains: provider.domains,
            certsDir,
            name
          };

          const factory = getFactory(name, provider);

          return factory.configure(config).then(() => {
            return factory;
          });
        })
        .value()
    );
  }
);
