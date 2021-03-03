const fs = require('fs');

const { generateFilePromise, formatFilesData, STAT_TYPES } = require('./read');

const generateRecursiveFilePromise = (dir, file) => {
  return generateFilePromise(dir, file).then(fileData => {
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

  return new Promise((resolve, reject) => {
    fs.readdir(dir, (error, files) => {
      if (error) {
        reject(error);
      }
      processFiles(files).then(filesData => {
        resolve(formatFilesData(filesData));
      });
    });
  });
}

module.exports = {
  walk,
};
