import * as Promise from 'bluebird';
import * as path from 'path';
import { CertificateFactoryBase, CertificateConfig } from './base';
import { SelfSignedCertificateProvider } from '../../../../ingress-controller-parser/lib';

export class SelfSignedCertificateFactory extends CertificateFactoryBase {
  config?: CertificateConfig;
  pemPath?: string;
  provider: SelfSignedCertificateProvider;

  constructor(name: string, provider: SelfSignedCertificateProvider) {
    super(name, provider);
    this.provider = provider;
  }

  configure(certConfig: CertificateConfig): Promise<void> {
    this.config = certConfig;
    this.pemPath = path.join(this.config.certsDir, `${this.name}.pem`);

    return Promise.resolve();
  }

  intialise(): Promise<void> {
    if (this.config == null) {
      throw new Error(
        'Unable to initialise due to bad certificate configuration'
      );
    }

    return this.readPemFile(this.pemPath)
      .then(pem => {
        if (pem === '') {
          return this.createTemporaryCertificate(this.pemPath);
        }
      })
      .then(_ => this.ready());
  }
}
