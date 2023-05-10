const path = require('path');
const fs = require('fs');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const escapeRegExp = require('@hubspot/cli-lib/lib/escapeRegExp');
const i18nKey = 'cli.lib.prompts.uploadPrompt';
const FIELDS_FILES = ['fields.json', 'fields.js', 'fields.cjs', 'fields.mjs'];

const fieldsJsPrompt = async (filePath, projectDir, skipFiles = []) => {
  const dirName = path.dirname(filePath);

  // Get a list of all field files in the directory, resolve their absolute path, and remove the ones that we already skipped.
  const fileChoices = fs
    .readdirSync(dirName)
    .filter(file => FIELDS_FILES.includes(file))
    .map(file => path.resolve(dirName, file))
    .filter(file => !skipFiles.includes(file));

  if (!fileChoices.length) return [filePath, []];
  if (fileChoices.length == 1) return [fileChoices[0], []];

  // We get the directory above the project one so that relative paths are printed with the root of the project dir attached.
  projectDir = projectDir.substring(0, projectDir.lastIndexOf('/'));
  const projectDirRegex = new RegExp(`^${escapeRegExp(projectDir)}`);
  const fileDir = path.dirname(fileChoices[0]).replace(projectDirRegex, '');

  const selection = [];
  fileChoices.forEach(fileChoice => {
    selection.push({
      name: fileChoice.replace(projectDirRegex, ''),
      value: fileChoice,
    });
  });
  const promptVal = await promptUser([
    {
      message: i18n(`${i18nKey}.fieldsPrompt`, { dir: fileDir }),
      type: 'list',
      name: 'filePathChoice',
      choices: selection,
    },
  ]);
  const choice = promptVal.filePathChoice;

  // Add the ones that were not picked to skip files array.
  const notPicked = fileChoices.filter(item => item !== choice);
  skipFiles.push(...notPicked);
  return [choice, skipFiles];
};

module.exports = { fieldsJsPrompt };
