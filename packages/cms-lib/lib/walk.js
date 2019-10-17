const fs = require('fs');
const path = require('path');

function walk(dir) {
  const processFiles = files => {
    return Promise.all(
      files.map(file => {
        return new Promise((resolve, reject) => {
          const filepath = path.join(dir, file);
          fs.stat(filepath, (error, stats) => {
            if (error) {
              reject(error);
            }
            if (stats.isDirectory()) {
              walk(filepath).then(resolve);
            } else if (stats.isFile()) {
              resolve(filepath);
            }
          });
        });
      })
    );
  };
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (error, files) => {
      if (error) {
        reject(error);
      }
      processFiles(files).then(foldersContents => {
        resolve(
          foldersContents.reduce(
            (all, folderContents) => all.concat(folderContents),
            []
          )
        );
      });
    });
  });
}

module.exports = {
  walk,
};
