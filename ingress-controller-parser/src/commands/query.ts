import { Command, flags } from '@oclif/command';
import * as Promise from 'bluebird';
import * as parser from '../utils/parser';

export default class Query extends Command {
  static description = 'Extracts information from a valid configuration';

  static examples = [
    `$ icp query -f ./ingress-controller.yaml -p ingress[0].port`
  ];

  static flags = {
    file: flags.string({
      char: 'f', // shorter flag version
      description: 'file to validate', // help description for flag
      hidden: false, // hide from help
      multiple: false, // allow setting this flag multiple times
      required: true // make flag required (this is not common and you should probably use an argument instead)
    }),
    path: flags.string({
      char: 'p',
      description: 'path within the config to query',
      required: true,
      default: '$..*'
    }),
    count: flags.integer({
      char: 'c',
      description: 'number of results you wish to see',
      required: false
    })
  };

  static args = [];

  run = () => {
    const { flags } = this.parse(Query);

    return parser
      .getConfig(flags.file)
      .then(config => parser.parseConfig(config))
      .then(config => {
        const results = parser.queryConfig(config, flags.path, flags.count);
        console.log(JSON.stringify(results, null, 2));
      })
      .catch((err: Error) => {
        console.error(`Invalid config. ${err.message}`);
        process.exitCode = 1;
      });
  };
}
