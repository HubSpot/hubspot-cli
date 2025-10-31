import path from 'path';
import fs from 'fs-extra';
import { fetchRepoFile } from '@hubspot/local-dev-lib/api/github';
import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';

import { createApiSamplePrompt } from '../../lib/prompts/createApiSamplePrompt.js';
import { confirmPrompt } from '../../lib/prompts/promptUtils.js';
import { debugError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { CreatableCmsAsset, ApiSampleConfig } from '../../types/Cms.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';

const apiSampleAssetType: CreatableCmsAsset = {
  hidden: true,
  dest: ({ dest }) => dest!,
  validate: ({ name }) => {
    if (!name) {
      uiLogger.error(commands.create.subcommands.apiSample.errors.nameRequired);
      return false;
    }

    return true;
  },
  execute: async ({ dest, name, assetType, commandArgs }) => {
    const filePath = path.join(dest!, name!);
    if (fs.existsSync(filePath)) {
      const overwrite = await confirmPrompt(
        commands.create.subcommands.apiSample.folderOverwritePrompt(filePath),
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
      const { data } = await fetchRepoFile<ApiSampleConfig>(
        'HubSpot/sample-apps-list',
        'samples.json',
        'main'
      );
      samplesConfig = data;
    } catch (err) {
      debugError(err);
    }

    if (!samplesConfig) {
      uiLogger.error(commands.create.subcommands.apiSample.errors.noSamples);
      process.exit(EXIT_CODES.ERROR);
    }

    const { sampleType, sampleLanguage } =
      await createApiSamplePrompt(samplesConfig);

    if (!sampleType || !sampleLanguage) {
      uiLogger.error(commands.create.subcommands.apiSample.errors.noSamples);
      process.exit(EXIT_CODES.ERROR);
    }

    uiLogger.info(
      commands.create.subcommands.apiSample.info.sampleChosen(
        sampleType,
        sampleLanguage
      )
    );
    const created = await cloneGithubRepo(`HubSpot/${sampleType}`, filePath, {
      ...commandArgs,
      type: assetType,
      sourceDir: sampleLanguage,
    });
    if (created) {
      if (fs.existsSync(`${filePath}/.env.template`)) {
        fs.copySync(`${filePath}/.env.template`, `${filePath}/.env`);
      }
      uiLogger.success(
        commands.create.subcommands.apiSample.success.sampleCreated(filePath)
      );
    }
  },
};

export default apiSampleAssetType;
