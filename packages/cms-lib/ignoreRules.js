const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const findup = require('findup-sync');

// Rules used by ignore do not allow RegEx -- we are basing most of this list
// on the Junk library, which uses RegEx https://github.com/sindresorhus/junk/blob/master/index.js#L3
const ignoreList = [
  '**/node_modules', // dependencies
  '**/.*', // hidden files/folders
  '**/*.log', // Error log for npm
  '**/*.swp', // Swap file for vim state

  // # macOS
  '**/Icon\\r', // Custom Finder icon: http://superuser.com/questions/298785/icon-file-on-os-x-desktop
  '**/__MACOSX', // Resource fork

  // # Linux
  '**/~', // Backup file

  // # Windows
  '**/Thumbs.db', // Image file cache
  '**/ehthumbs.db', // Folder config file
  '**/Desktop.ini', // Stores custom folder attributes
  '**/@eaDir', // Synology Diskstation "hidden" folder where the server stores thumbnails
];

const ignoreRules = ignore().add(ignoreList);

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

function ignoreFile(filePath) {
  ignoreRules.add(filePath);
}

module.exports = {
  loadIgnoreConfig,
  shouldIgnoreFile,
  createIgnoreFilter,
  ignoreFile,
};
