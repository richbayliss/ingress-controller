import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';
import { CertificateFactoryBase, CertificateConfig } from './base';
import { writeToFile } from '../file';
import { StaticCertificateProvider } from '../../../../ingress-controller-parser/lib';

export class StaticCertificateFactory extends CertificateFactoryBase {
  cert = '';
  key = '';
  certConfig?: CertificateConfig;
  provider: StaticCertificateProvider;

  constructor(name: string, provider: StaticCertificateProvider) {
    super(name, provider);
    this.provider = provider;
  }

  configure(certConfig: CertificateConfig): Promise<void> {
    this.cert = Buffer.from(this.provider.static.cert, 'base64').toString();
    this.key = Buffer.from(this.provider.static.key, 'base64').toString();
    this.certConfig = certConfig;

    return Promise.resolve();
  }

  intialise(): Promise<void> {
    if (this.certConfig == null) {
      throw new Error(
        'Unable to initialise due to bad certificate configuration'
      );
    }

    const certPath = path.join(
      this.certConfig.certsDir,
      `${this.certConfig.name}.cert`
    );
    const keyPath = path.join(
      this.certConfig.certsDir,
      `${this.certConfig.name}.key`
    );
    const combinedPath = path.join(
      this.certConfig.certsDir,
      `${this.certConfig.name}.pem`
    );
    const combinedPem = [this.cert, this.key].join('\r\n');

    return writeToFile(certPath, this.cert)
      .then(() => writeToFile(keyPath, this.key))
      .then(() => writeToFile(combinedPath, combinedPem))
      .then(() => this.ready());
  }
}
