const path = require('path');
const fs = require('fs');

const CHANGELOG_SEPARATOR = '==========';
const CHANGELOG_VERSION_PREFIX = '##';

const parseArguments = args => {
  return {
    number: args[2],
    title: args[3],
    url: args[4],
  };
};

const updateChangeLog = prData => {
  const changelogEntry = `\n* ${prData.title} ([#${prData.number}](${prData.url}))`;
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
  const addLinebreak =
    beginningOfPreviousVersionLogIndex - endOfHeaderIndex === 1;
  console.log('addLinebreak: ', addLinebreak);
  const newChangelogContent = `${changelogContent.slice(
    0,
    endOfHeaderIndex
  )}${changelogEntry}${addLinebreak ? '\n' : ''}${changelogContent.slice(
    endOfHeaderIndex,
    beginningOfPreviousVersionLogIndex
  )}${changelogContent.slice(beginningOfPreviousVersionLogIndex, -1)}\n`;
  fs.writeFileSync(changelogPath, newChangelogContent);
};

updateChangeLog(parseArguments(process.argv));
