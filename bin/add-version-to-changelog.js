const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const lernaJson = require(path.join(__dirname, '../lerna.json'));

console.log('lernaJson version: ', lernaJson.version);

const CHANGELOG_SEPARATOR = '==========';
const CHANGELOG_VERSION_PREFIX = '##';

const updateChangeLog = changelogVersion => {
  const changelogEntry = `\n${CHANGELOG_VERSION_PREFIX} ${changelogVersion}`;
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');
  console.log('changelog entry: ', changelogEntry);
  const changelogContent = fs.readFileSync(changelogPath);
  const endOfHeaderIndex =
    changelogContent.indexOf(CHANGELOG_SEPARATOR) + CHANGELOG_SEPARATOR.length;
  const beginningOfPreviousVersionLogIndex = changelogContent.indexOf(
    CHANGELOG_VERSION_PREFIX
  );
  console.log('separator index: ', endOfHeaderIndex);
  console.log('version prefix index: ', beginningOfPreviousVersionLogIndex);
  const newChangelogContent = `${changelogContent.slice(
    0,
    endOfHeaderIndex
  )}${changelogEntry}${changelogContent.slice(
    endOfHeaderIndex,
    beginningOfPreviousVersionLogIndex
  )}${changelogContent.slice(beginningOfPreviousVersionLogIndex, -1)}\n`;
  fs.writeFileSync(changelogPath, newChangelogContent);
};

const commitChangelog = () => {
  exec('git add CHANGELOG.md');
  exec('git commit -m "Auto updated CHANGELOG.md version"');
  exec('git fetch origin master');
  exec('git push origin HEAD:master');
};

if (lernaJson.version.indexOf('beta') !== -1) return;
updateChangeLog(lernaJson.version);
commitChangelog();
