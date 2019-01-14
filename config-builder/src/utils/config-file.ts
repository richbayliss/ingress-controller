import * as Promise from 'bluebird';
import * as _ from 'lodash';

export type ConfigFileOptions = {
  newLine: string;
  indentChar: string;
};

export interface ConfigFile {
  startIndent(): ConfigFile;
  endIndent(): ConfigFile;
  addLine(line: string): ConfigFile;
  addLines(lines: string[]): ConfigFile;
  content(): string;
}

export const startConfigFile = Promise.method(
  (opts?: ConfigFileOptions): ConfigFile => {
    const settings: ConfigFileOptions = _.extend(
      {
        newLine: '\r\n',
        indentChar: '  '
      },
      opts || {}
    );

    const lines: string[] = [];
    let indents = 0;

    const configFile: ConfigFile = {
      startIndent: () => {
        indents++;
        return configFile;
      },
      endIndent: () => {
        if (indents > 0) indents--;
        return configFile;
      },
      addLine: (line: string) => {
        lines.push(`${_.repeat(settings.indentChar, indents)}${line}`);
        return configFile;
      },
      addLines: (lines: string[]) => {
        _.each(lines, line => configFile.addLine(line));
        return configFile;
      },
      content: () => lines.join(settings.newLine)
    };

    return configFile;
  }
);
