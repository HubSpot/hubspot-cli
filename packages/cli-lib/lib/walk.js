const fs = require('fs');
const path = require('path');

const STAT_TYPES = {
  FILE: 'file',
  SYMBOLIC_LINK: 'symlink',
  DIRECTORY: 'dir',
};

const generateFilePromise = (dir, file, { shallow = false } = {}) => {
  return new Promise((resolve, reject) => {
    const filepath = path.join(dir, file);
    fs.lstat(filepath, (error, stats) => {
      if (error) {
        reject(error);
      }
      if (stats.isSymbolicLink()) {
        resolve({
          filepath,
          type: STAT_TYPES.SYMBOLIC_LINK,
        });
      }
      if (stats.isDirectory()) {
        shallow
          ? resolve({
              filepath,
              type: STAT_TYPES.DIRECTORY,
              files: [],
            })
          : walk(filepath).then(files => {
              return resolve({
                filepath,
                type: STAT_TYPES.DIRECTORY,
                files,
              });
            });
      } else if (stats.isFile()) {
        resolve({
          filepath,
          type: STAT_TYPES.FILE,
        });
      }
    });
  });
};

const filesDataReducer = filesData => {
  return filesData.reduce((acc, fileData) => {
    switch (fileData.type) {
      case STAT_TYPES.FILE:
        return acc.concat(fileData.filepath);
      case STAT_TYPES.DIRECTORY:
        return acc.concat(fileData.files);
      case STAT_TYPES.SYMBOLIC_LINK:
        // Skip symlinks
        return acc;
      default:
        return acc;
    }
  }, []);
};

function getFiles(dir, fileProcessor) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (error, files) => {
      if (error) {
        reject(error);
      }
      fileProcessor(files).then(filesData => {
        resolve(filesDataReducer(filesData));
      });
    });
  });
}

function getDirectoryFiles(dir) {
  const processFiles = files =>
    Promise.all(
      files.map(file => generateFilePromise(dir, file, { shallow: true }))
    );

  return getFiles(dir, processFiles);
}

function walk(dir) {
  const processFiles = files =>
    Promise.all(files.map(file => generateFilePromise(dir, file)));

  return getFiles(dir, processFiles);
}

module.exports = {
  walk,
  getDirectoryFiles,
};
