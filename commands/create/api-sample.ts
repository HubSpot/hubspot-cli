// @ts-nocheck 
const {
  createApiSamplePrompt,
} = require('../../lib/prompts/createApiSamplePrompt');
const {
  folderOverwritePrompt,
} = require('../../lib/prompts/folderOverwritePrompt');
const { logger } = require('@hubspot/local-dev-lib/logger');
const path = require('path');
const fs = require('fs-extra');
const {
  fetchFileFromRepository,
  cloneGithubRepo,
} = require('@hubspot/local-dev-lib/github');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.create.subcommands.apiSample';

module.exports = {
  hidden: true,
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      logger.error(i18n(`${i18nKey}.errors.nameRequired`));
      return false;
    }

    return true;
  },
  execute: async ({ dest, name, assetType, options }) => {
    const filePath = path.join(dest, name);
    if (fs.existsSync(filePath)) {
      const { overwrite } = await folderOverwritePrompt(filePath);
      if (overwrite) {
        fs.rmdirSync(filePath, { recursive: true });
      } else {
        return;
      }
    }

    const samplesConfig = await fetchFileFromRepository(
      'HubSpot/sample-apps-list',
      'samples.json',
      'main'
    );

    if (!samplesConfig) {
      logger.error(i18n(`${i18nKey}.errors.noSamples`));
      return;
    }
    const { sampleType, sampleLanguage } = await createApiSamplePrompt(
      samplesConfig
    );
    if (!sampleType || !sampleLanguage) {
      logger.error(i18n(`${i18nKey}.errors.noSamples`));
      return;
    }
    logger.info(
      i18n(`${i18nKey}.info.sampleChosen`, {
        sampleType,
        sampleLanguage,
      })
    );
    const created = await cloneGithubRepo(`HubSpot/${sampleType}`, filePath, {
      type: assetType,
      sourceDir: sampleLanguage,
      ...options,
    });
    if (created) {
      if (fs.existsSync(`${filePath}/.env.template`)) {
        fs.copySync(`${filePath}/.env.template`, `${filePath}/.env`);
      }
      logger.success(
        i18n(`${i18nKey}.success.sampleCreated`, {
          filePath,
        })
      );
    }
  },
};
