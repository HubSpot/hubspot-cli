const { createTemplatePrompt } = require('../../lib/createTemplatePrompt');
const { logger } = require('@hubspot/cli-lib/logger');
const path = require('path');
const fs = require('fs-extra');

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
    logger.error(`The ${filePath} path already exists`);
    return;
  }
  logger.debug(`Making ${dest} if needed`);
  fs.mkdirp(dest);
  logger.log(`Creating file at ${filePath}`);
  fs.copySync(assetPath, filePath);
};

module.exports = {
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      logger.error("The 'name' argument is required when creating a Template.");
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
