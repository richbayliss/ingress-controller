import * as Promise from 'bluebird';
import * as fs from 'fs';

export const writeToFile = Promise.method((path: fs.PathLike, data: string) => {
  fs.writeFile(path, data, err => {
    if (err) {
      return Promise.reject(err);
    }

    return Promise.resolve();
  });
});

export const getStat = Promise.promisify(fs.lstat).bind(fs);

export const checkFileExists = (path: fs.PathLike) =>
  getStat(path).then(stat => {
    if (!stat.isFile) {
      throw new Error('Path is not a file');
    }
  });

export const checkPathIsDirectory = (path: fs.PathLike) =>
  getStat(path).then(stat => {
    if (!stat.isDirectory) {
      throw new Error('Config directory is not a directory');
    }

    return true;
  });

export const readFromFile = Promise.promisify(fs.readFile);
