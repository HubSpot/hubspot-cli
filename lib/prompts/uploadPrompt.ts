// @ts-nocheck
const path = require('path');
import inquirer from 'inquirer';
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.uploadPrompt';

const uploadPrompt = (promptOptions = {}) => {
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

module.exports = {
  uploadPrompt,
};
