const fs = require('fs');

const {
  getFileInfoAsync,
  flattenAndRemoveSymlinks,
  STAT_TYPES,
} = require('./read');

const generateRecursiveFilePromise = (dir, file) => {
  return getFileInfoAsync(dir, file).then(fileData => {
    return new Promise(resolve => {
      if (fileData.type === STAT_TYPES.DIRECTORY) {
        walk(fileData.filepath).then(files => {
          resolve({ ...fileData, files });
        });
      } else {
        resolve(fileData);
      }
    });
  });
};

function walk(dir) {
  const processFiles = files =>
    Promise.all(files.map(file => generateRecursiveFilePromise(dir, file)));

  return fs.promises.readdir(dir, (error, files) => {
    if (error) {
      return error;
    }
    processFiles(files).then(filesData => {
      return flattenAndRemoveSymlinks(filesData);
    });
  });
}

module.exports = {
  walk,
};
