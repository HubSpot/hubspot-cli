const path = require('path');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.previewPrompt';

const previewPrompt = (promptOptions = {}) => {
  return promptUser([
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
  return promptUser([
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
