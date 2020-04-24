import fs = require('fs');
import path = require('path');
import ignore from 'ignore';
import findup = require('findup-sync');

const ignoreList = [
  'hubspot.config.yml',
  'hubspot.config.yaml',
  'node_modules', // dependencies
  '.*', // hidden files/folders
  '*.log', // Error log for npm
  '*.swp', // Swap file for vim state

  // # macOS
  'Icon\\r', // Custom Finder icon: http://superuser.com/questions/298785/icon-file-on-os-x-desktop
  '__MACOSX', // Resource fork

  // # Linux
  '~', // Backup file

  // # Windows
  'Thumbs.db', // Image file cache
  'ehthumbs.db', // Folder config file
  'Desktop.ini', // Stores custom folder attributes
  '@eaDir', // Synology Diskstation "hidden" folder where the server stores thumbnails
];

const ignoreRules = ignore().add(ignoreList);

let configPath = null;
let loaded = false;

export function loadIgnoreConfig() {
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

export function shouldIgnoreFile(file, cwd) {
  loadIgnoreConfig();
  const relativeTo = configPath || cwd;
  return ignoreRules.ignores(path.relative(relativeTo, file));
}

export function createIgnoreFilter(cwd) {
  loadIgnoreConfig();
  return file => !shouldIgnoreFile(file, cwd);
}

export function ignoreFile(filePath) {
  ignoreRules.add(filePath);
}
