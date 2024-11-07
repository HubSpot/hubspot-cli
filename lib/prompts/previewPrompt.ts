// @ts-nocheck
const path = require('path');
import inquirer from 'inquirer';
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.previewPrompt';

const previewPrompt = (promptOptions = {}) => {
  return inquirer.prompt([
    {
      name: 'src',
      message: i18n(`${i18nKey}.enterSrc`),
      when: !promptOptions.src,
      default: '.',
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.srcRequired`);
        }
        return true;
      },
    },
    {
      name: 'dest',
      message: i18n(`${i18nKey}.enterDest`),
      when: !promptOptions.dest,
      default: path.basename(getCwd()),
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.destRequired`);
        }
        return true;
      },
    },
  ]);
};

const previewProjectPrompt = async themeComponents => {
  return inquirer.prompt([
    {
      name: 'themeComponentPath',
      message: i18n(`${i18nKey}.themeProjectSelect`),
      type: 'list',
      choices: themeComponents.map(t => {
        const themeName = path.basename(t.path);
        return {
          name: themeName,
          value: t.path,
        };
      }),
    },
  ]);
};

module.exports = {
  previewPrompt,
  previewProjectPrompt,
};
