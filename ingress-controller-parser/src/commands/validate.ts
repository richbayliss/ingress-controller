import { Command, flags } from '@oclif/command';
import * as Promise from 'bluebird';
import * as parser from '../utils/parser';

export default class Validate extends Command {
  static description = 'Determines if a configuration YAML is valid';

  static examples = [`$ icp validate ./ingress-controller.yaml`];

  static flags = {
    file: flags.string({
      char: 'f', // shorter flag version
      description: 'file to validate', // help description for flag
      hidden: false, // hide from help
      multiple: false, // allow setting this flag multiple times
      required: true // make flag required (this is not common and you should probably use an argument instead)
    })
  };

  static args = [];

  run = () => {
    const { flags } = this.parse(Validate);

    return parser
      .getConfig(flags.file)
      .then(config => parser.parseConfig(config))
      .catch((err: Error) => {
        console.error(`Invalid config. ${err.message}`);
        process.exitCode = 1;
      });
  };
}
