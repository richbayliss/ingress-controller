import * as Promise from 'bluebird';
import * as forge from 'node-forge';
import { readFromFile, writeToFile } from '../file';
import { EventEmitter } from 'events';
import * as moment from 'moment';
import { logger } from '../logger';
import { CertificateProviderBase } from '../../../../ingress-controller-parser/lib';

const log = logger('CertAgent');

export interface CertificateConfig {
  certsDir: string;
  domains: string[];
  name: string;
}

export interface CertificateFactory {
  configure(config: CertificateConfig): Promise<void>;
  intialise(): Promise<void>;
}

export abstract class CertificateFactoryBase extends EventEmitter
  implements CertificateFactory {
  name: string;
  provider: CertificateProviderBase;
  constructor(name: string, provider: CertificateProviderBase) {
    super();
    this.name = name;
    this.provider = provider;
  }

  abstract configure(config: CertificateConfig): Promise<void>;
  abstract intialise(): Promise<void>;

  protected ready = () => {
    log.debug(
      `[CertificateFactoryBase] '${this.name}' is fired the ready event`
    );
    this.emit('ready', {
      name: this.name
    });
  };

  readPemFile(path: string) {
    return readFromFile(path)
      .catch(_ => {
        return '';
      })
      .then(pem => {
        return pem.toString();
      });
  }

  createTemporaryCertificate(path: string) {
    // if we have no PEM on disk then create a self-signed one for now...
    const { cert, key } = createSelfSignedCertificate();

    // write them to disk, then wait 10 secs...
    return writeToFile(path, [cert, key].join('\r\n'));
  }
}

export type OnRenewEventHandler = (args: any) => void;

export abstract class DynamicCertificateFactoryBase extends CertificateFactoryBase {
  protected didChange = () => {
    this.emit('renew', {
      name: this.name
    });
  };
}

export const createSelfSignedCertificate = () => {
  const pki = forge.pki;

  // generate a keypair and create an X.509v3 certificate
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';

  const now: moment.Moment = moment();
  cert.validity.notBefore = now.toDate();
  cert.validity.notAfter = now.add(100, 'years').toDate();
  const attrs = [
    {
      name: 'commonName',
      value: 'Ingress Controller Self-Signed'
    },
    {
      name: 'countryName',
      value: 'US'
    },
    {
      shortName: 'ST',
      value: 'Washington'
    },
    {
      name: 'localityName',
      value: 'Seattle'
    },
    {
      name: 'organizationName',
      value: 'Balena'
    },
    {
      shortName: 'OU',
      value: 'None'
    }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true
    },
    {
      name: 'nsCertType',
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true
    },
    {
      name: 'subjectKeyIdentifier'
    }
  ]);
  cert.sign(keys.privateKey);

  return {
    cert: pki.certificateToPem(cert),
    key: pki.privateKeyToPem(keys.privateKey)
  };
};
