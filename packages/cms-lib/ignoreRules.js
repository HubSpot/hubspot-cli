const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const findup = require('findup-sync');

const hiddenFilesRegEx = /(^|\/)\.[^/.]/g;
const ignoreRules = ignore()
  .add('node_modules')
  .add(hiddenFilesRegEx);

let configPath = null;
let loaded = false;
function loadIgnoreConfig() {
  if (loaded) {
    return;
  }
  const file = findup('.hsignore');
  if (file) {
    if (fs.existsSync(file)) {
      ignoreRules.add(fs.readFileSync(file).toString());
      configPath = path.dirname(file);
    }
  }
  loaded = true;
}

function shouldIgnoreFile(file, cwd) {
  loadIgnoreConfig();
  const relativeTo = configPath || cwd;
  return ignoreRules.ignores(path.relative(relativeTo, file));
}

function createIgnoreFilter(cwd) {
  loadIgnoreConfig();
  return file => !shouldIgnoreFile(file, cwd);
}

module.exports = {
  loadIgnoreConfig,
  shouldIgnoreFile,
  createIgnoreFilter,
};
