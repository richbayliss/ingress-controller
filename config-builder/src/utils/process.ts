import * as Promise from 'bluebird';
import { exec } from 'child_process';
import { logger } from '../utils/logger';

const log = logger('runCommand');

export const runCommand = (command: string) => {
  log.debug(`Running: '${command}'`);
  const child = exec(command);

  return new Promise((resolve, reject) => {
    child.addListener('exit', resolve);
    child.addListener('error', reject);
  });
};
