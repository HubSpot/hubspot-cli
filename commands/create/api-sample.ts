// @ts-nocheck
const {
  createApiSamplePrompt,
} = require('../../lib/prompts/createApiSamplePrompt');
const { confirmPrompt } = require('../../lib/prompts/promptUtils');
const { logger } = require('@hubspot/local-dev-lib/logger');
const path = require('path');
const fs = require('fs-extra');
const { fetchRepoFile } = require('@hubspot/local-dev-lib/api/github');
const { cloneGithubRepo } = require('@hubspot/local-dev-lib/github');
const { i18n } = require('../../lib/lang');
const { debugError } = require('../../lib/errorHandlers');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

module.exports = {
  hidden: true,
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      logger.error(
        i18n(`commands.create.subcommands.apiSample.errors.nameRequired`)
      );
      return false;
    }

    return true;
  },
  execute: async ({ dest, name, assetType, options }) => {
    const filePath = path.join(dest, name);
    if (fs.existsSync(filePath)) {
      const overwrite = await confirmPrompt(
        i18n(`commands.create.subcommands.apiSample.folderOverwritePrompt`, {
          folderName: filePath,
        }),
        { defaultAnswer: false }
      );
      if (overwrite) {
        fs.rmdirSync(filePath, { recursive: true });
      } else {
        return;
      }
    }

    let samplesConfig;
    try {
      const { data } = await fetchRepoFile(
        'HubSpot/sample-apps-list',
        'samples.json',
        'main'
      );
      samplesConfig = data;
    } catch (err) {
      debugError(err);
    }

    if (!samplesConfig) {
      logger.error(
        i18n(`commands.create.subcommands.apiSample.errors.noSamples`)
      );
      process.exit(EXIT_CODES.ERROR);
    }

    const { sampleType, sampleLanguage } =
      await createApiSamplePrompt(samplesConfig);

    if (!sampleType || !sampleLanguage) {
      logger.error(
        i18n(`commands.create.subcommands.apiSample.errors.noSamples`)
      );
      process.exit(EXIT_CODES.ERROR);
    }

    logger.info(
      i18n(`commands.create.subcommands.apiSample.info.sampleChosen`, {
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
        i18n(`commands.create.subcommands.apiSample.success.sampleCreated`, {
          filePath,
        })
      );
    }
  },
};
