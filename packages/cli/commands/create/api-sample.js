const { createApiSamplePrompt } = require('../../lib/createApiSamplePrompt');
const { folderOverwritePrompt } = require('../../lib/prompts');
const { logger } = require('@hubspot/cli-lib/logger');
const path = require('path');
const fs = require('fs-extra');
const ora = require('ora');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { GITHUB_RELEASE_TYPES } = require('@hubspot/cli-lib/lib/constants');
const { createProject } = require('@hubspot/cli-lib/projects');

module.exports = {
  hidden: true,
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      logger.error(
        "The 'name' argument is required when creating an API Sample."
      );
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
    const downloadSpinner = ora('Loading available API samples');
    downloadSpinner.start();
    const samplesConfig = await fetchJsonFromRepository(
      'sample-apps-list',
      'main/samples.json'
    );
    downloadSpinner.stop();
    if (!samplesConfig) {
      logger.error(
        `Currently there are no samples available, please, try again later.`
      );
      return;
    }
    const { sampleType, sampleLanguage } = await createApiSamplePrompt(
      samplesConfig
    );
    if (!sampleType || !sampleLanguage) {
      logger.error(
        `Currently there are no samples available, please, try again later.`
      );
      return;
    }
    logger.info(
      `You've chosen ${sampleType} sample written on ${sampleLanguage} language`
    );
    const created = await createProject(
      filePath,
      assetType,
      sampleType,
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
        `Please, follow ${filePath}/README.md to find out how to run the sample`
      );
    }
  },
};
