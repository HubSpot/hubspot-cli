const {
  createApiSamplePrompt,
} = require('../../lib/prompts/createApiSamplePrompt');
const {
  folderOverwritePrompt,
} = require('../../lib/prompts/folderOverwritePrompt');
const { logger } = require('@hubspot/cli-lib/logger');
const path = require('path');
const fs = require('fs-extra');
const ora = require('ora');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { GITHUB_RELEASE_TYPES } = require('@hubspot/cli-lib/lib/constants');
const { cloneGitHubRepo } = require('@hubspot/cli-lib/github');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.create.subcommands.apiSample';

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
    const downloadSpinner = ora(i18n(`${i18nKey}.loading.apiSamples`));
    downloadSpinner.start();
    const samplesConfig = await fetchJsonFromRepository(
      'HubSpot/sample-apps-list',
      'samples.json',
      'main'
    );
    downloadSpinner.stop();
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
    const created = await cloneGitHubRepo(
      filePath,
      assetType,
      `HubSpot/${sampleType}`,
      sampleLanguage,
      {
        ...options,
        releaseType: GITHUB_RELEASE_TYPES.REPOSITORY,
      }
    );
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
