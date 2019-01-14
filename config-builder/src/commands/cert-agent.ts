import { Command, flags } from '@oclif/command';
import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as parser from '../../../ingress-controller-parser/lib/index';
import { configureCertificateFactories } from '../utils/certificate';
import { checkPathIsDirectory } from '../utils/file';
import {
  CertificateFactoryBase,
  DynamicCertificateFactoryBase
} from '../utils/certificate/base';
import { runCommand } from '../utils/process';
import { logger } from '../utils/logger';
import { tick } from 'figures';

const log = logger('CertAgent');

export default class CertAgent extends Command {
  static description = '';

  static examples = [];

  static args = [];

  static flags = {
    in: flags.string({
      char: 'i',
      required: false
    }),
    configDir: flags.string({
      char: 'o',
      required: true
    }),
    onChange: flags.string({
      required: false,
      default: ''
    }),
    onReady: flags.string({
      required: false,
      default: ''
    })
  };

  addRenewEventHook = Promise.method(
    (factories: CertificateFactoryBase[], command: string) => {
      if (command === '') {
        return factories;
      }

      return Promise.resolve(
        _.each(factories, factory => {
          if (factory instanceof DynamicCertificateFactoryBase) {
            factory.on('renew', _ => {
              log.info(
                `Renewed cert for factory: '${
                  factory.name
                }. Running renew script...`
              );
              return runCommand(command);
            });
            log.info(`Added renew hooks for factory: ${factory.name}`);
          }
        })
      );
    }
  );

  run() {
    const { flags } = this.parse(CertAgent);

    // keep the agent alive...
    setInterval(() => {}, 86400);

    log.info('Starting...');

    return checkPathIsDirectory(flags.configDir)
      .then(() => {
        log.info('Reading ingress configuration...');
        return parser.getConfig(flags.in || '-');
      })
      .then((config: string) => {
        log.info('Parsing ingress configuration...');
        return parser.parseConfig(config);
      })
      .then((config: parser.IngressConfig) => {
        log.info('Configuring certificate factories...');
        return configureCertificateFactories(config, flags.configDir);
      })
      .then((factories: CertificateFactoryBase[]) =>
        this.addRenewEventHook(factories, flags.onChange)
      )
      .then((factories: CertificateFactoryBase[]) => {
        log.info('Initialising certificate factories...');
        return Promise.all(
          _.map(factories, factory => {
            return factory.intialise().then(() => {
              log.info(`- ${factory.name} ${tick}`);
            });
          })
        ).tap(() => {
          log.info('Initialised!');
        });
      })
      .then(() => {
        if (flags.onReady === '') {
          log.debug('No --onReady script provided');
          return;
        }

        log.info('Running ready script...');
        return runCommand(flags.onReady);
      })
      .then(() => {
        log.info('Ready!');
      });
  }
}
