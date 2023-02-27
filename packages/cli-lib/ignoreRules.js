const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const findup = require('findup-sync');

const ignoreList = [
  'fields.output.json',
  'hubspot.config.yml',
  'hubspot.config.yaml',
  'node_modules', // dependencies
  '.*', // hidden files/folders
  '*.log', // Error log for npm
  '*.swp', // Swap file for vim state
  '.env', // Dotenv file
  // # macOS
  'Icon\\r', // Custom Finder icon: http://superuser.com/questions/298785/icon-file-on-os-x-desktop
  '__MACOSX', // Resource fork

  // # Linux
  '~', // Backup file

  // # Emacs
  '*~', // Backup file

  // # Windows
  'Thumbs.db', // Image file cache
  'ehthumbs.db', // Folder config file
  'Desktop.ini', // Stores custom folder attributes
  '@eaDir', // Synology Diskstation "hidden" folder where the server stores thumbnails
];

const ignoreRules = ignore().add(ignoreList);

let searchDomain = null;
let loaded = false;
function loadIgnoreConfig(isInProject = false) {
  if (loaded) {
    return;
  }

  // Temporary solution to improve serverless beta: https://git.hubteam.com/HubSpot/cms-devex-super-repo/issues/2
  // Do not do this when in a developer project b/c we want the package-lock.json file uploaded.
  if (!isInProject) {
    ignoreRules.add('package-lock.json');
  }

  const file = findup('.hsignore');
  if (file) {
    if (fs.existsSync(file)) {
      ignoreRules.add(fs.readFileSync(file).toString());
      searchDomain = path.dirname(file);
    }
  }
  loaded = true;
}

function shouldIgnoreFile(file, isInProject) {
  loadIgnoreConfig(isInProject);
  const relativeTo = searchDomain || '/';
  const relativePath = path.relative(relativeTo, file);

  return !!relativePath && ignoreRules.ignores(relativePath);
}

function createIgnoreFilter(isInProject) {
  loadIgnoreConfig(isInProject);
  return file => !shouldIgnoreFile(file);
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
