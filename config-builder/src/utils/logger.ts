import * as winston from 'winston';
import { env } from 'process';

export const logger = (component = '') => {
  return getComponentLog(component);
};

const getComponentLog = (component = '') => {
  const tag = component !== '' ? `[${component}]` : '';
  return winston.createLogger({
    level: env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(
        info => `${info.timestamp} ${info.level}: ${tag} ${info.message}`
      )
    ),
    transports: [new winston.transports.Console()]
  });
};
