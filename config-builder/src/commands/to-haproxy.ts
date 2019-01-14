import { Command, flags } from '@oclif/command';
import { buildProxyConfig } from '../utils/config';
import { writeToFile } from '../utils/file';
import * as Promise from 'bluebird';
import * as parser from '../../../ingress-controller-parser/lib/index';

export default class IngressToHaproxy extends Command {
  static description =
    'Builds an HAproxy configuration from an Ingress Controller configuration YAML';

  static examples = [
    'ingress to-haproxy -i /path/to/yaml -o /etc/haproxy.cfg',
    'echo $INGRESS_CONFIG | ingress to-haproxy -o /etc/haproxy.cfg'
  ];

  static args = [];
  static flags = {
    out: flags.string({
      char: 'o',
      required: false
    }),
    in: flags.string({
      char: 'i',
      required: false
    })
  };

  run() {
    const { flags } = this.parse(IngressToHaproxy);

    return parser
      .getConfig(flags.in || '-')
      .then(config => parser.parseConfig(config))
      .then(config => buildProxyConfig(config))
      .then(proxyConfig => {
        if (flags.out) {
          return writeToFile(flags.out, proxyConfig);
        }

        console.log(proxyConfig);
      });
  }
}
