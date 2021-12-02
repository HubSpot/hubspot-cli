const { createTemplatePrompt } = require('../../lib/createTemplatePrompt');
const { logger } = require('@hubspot/cli-lib/logger');
const path = require('path');
const fs = require('fs-extra');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.create.subcommands.template';

const ASSET_PATHS = {
  'page-template': path.resolve(__dirname, '../../defaults/page-template.html'),
  partial: path.resolve(__dirname, '../../defaults/partial.html'),
  'global-partial': path.resolve(
    __dirname,
    '../../defaults/global-partial.html'
  ),
  'email-template': path.resolve(
    __dirname,
    '../../defaults/email-template.html'
  ),
  'blog-listing-template': path.resolve(
    __dirname,
    '../../defaults/blog-listing-template.html'
  ),
  'blog-post-template': path.resolve(
    __dirname,
    '../../defaults/blog-post-template.html'
  ),
  'search-template': path.resolve(
    __dirname,
    '../../defaults/search-template.html'
  ),
};

const createTemplate = (name, dest, type = 'page-template') => {
  const assetPath = ASSET_PATHS[type];
  const filename = name.endsWith('.html') ? name : `${name}.html`;
  const filePath = path.join(dest, filename);
  if (fs.existsSync(filePath)) {
    logger.error(
      i18n(`${i18nKey}.errors.pathExists`, {
        path: filePath,
      })
    );
    return;
  }
  logger.debug(
    i18n(`${i18nKey}.debug.creatingPath`, {
      path: dest,
    })
  );
  fs.mkdirp(dest);
  logger.log(
    i18n(`${i18nKey}.log.creatingFile`, {
      path: filePath,
    })
  );
  fs.copySync(assetPath, filePath);
};

module.exports = {
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      logger.error(i18n(`${i18nKey}.errors.nameRequired`));
      return false;
    }

    return true;
  },
  execute: async ({ name, dest }) => {
    const { templateType } = await createTemplatePrompt();
    createTemplate(name, dest, templateType);
    return { templateType };
  },
};
