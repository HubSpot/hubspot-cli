import fs from 'fs-extra';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import open from 'open';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';

import {
  AccountArgs,
  YargsCommandModule,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../types/Yargs.js';
import { ProjectConfig, ProjectPollResult } from '../types/Projects.js';
import { commands } from '../lang/en.js';
import {
  trackCommandMetadataUsage,
  trackCommandUsage,
} from '../lib/usageTracking.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { promptUser } from '../lib/prompts/promptUtils.js';
import { projectNameAndDestPrompt } from '../lib/prompts/projectNameAndDestPrompt.js';
import {
  uiAccountDescription,
  uiFeatureHighlight,
  uiInfoSection,
} from '../lib/ui/index.js';
import { uiLogger } from '../lib/ui/logger.js';
import { debugError, logError } from '../lib/errorHandlers/index.js';
import { handleProjectUpload } from '../lib/projects/upload.js';
import {
  PROJECT_CONFIG_FILE,
  GET_STARTED_OPTIONS,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} from '../lib/constants.js';
import {
  writeProjectConfig,
  getProjectConfig,
  validateProjectConfig,
} from '../lib/projects/config.js';
import {
  getProjectPackageJsonLocations,
  installPackages,
} from '../lib/dependencyManagement.js';

import { pollProjectBuildAndDeploy } from '../lib/projects/pollProjectBuildAndDeploy.js';
import { isV2Project } from '../lib/projects/platformVersion.js';

import { openLink } from '../lib/links.js';
import { getStaticAuthAppInstallUrl } from '../lib/app/urls.js';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';

const command = 'get-started';
const describe = commands.getStarted.describe;

type GetStartedArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    name?: string;
    dest?: string;
  };

async function handler(
  args: ArgumentsCamelCase<GetStartedArgs>
): Promise<void> {
  const { derivedAccountId } = args;
  const env =
    getEnv(derivedAccountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  await trackCommandUsage('get-started', {}, derivedAccountId);

  const accountName = uiAccountDescription(derivedAccountId);

  uiInfoSection(commands.getStarted.startTitle, () => {
    uiLogger.log(commands.getStarted.startDescription);
    uiLogger.log(commands.getStarted.guideOverview(accountName));
  });

  const { default: selectedOption } = await promptUser<{ default: string }>([
    {
      type: 'list',
      name: 'default',
      message: commands.getStarted.prompts.selectOption,
      choices: [
        {
          name: commands.getStarted.prompts.options.app,
          value: GET_STARTED_OPTIONS.APP,
        },
        {
          name: commands.getStarted.prompts.options.cms,
          value: GET_STARTED_OPTIONS.CMS,
        },
      ],
      default: GET_STARTED_OPTIONS.APP,
    },
  ]);

  // Track user's initial choice
  await trackCommandMetadataUsage(
    'get-started',
    { step: 'select-option', type: selectedOption },
    derivedAccountId
  );

  if (selectedOption === GET_STARTED_OPTIONS.CMS) {
    uiLogger.log(' ');
    uiLogger.log(commands.getStarted.designManager);
    if (process.env.BROWSER !== 'none') {
      uiLogger.log(' ');
      const { shouldOpen } = await promptUser<{ shouldOpen: boolean }>([
        {
          name: 'shouldOpen',
          type: 'confirm',
          message: commands.getStarted.openDesignManagerPrompt,
        },
      ]);

      // Track Design Manager browser action
      await trackCommandMetadataUsage(
        'get-started',
        {
          step: 'open-design-manager',
          type: shouldOpen ? 'opened' : 'declined',
        },
        derivedAccountId
      );

      if (shouldOpen) {
        uiLogger.log('');
        openLink(derivedAccountId, 'design-manager');
      }
    }
    process.exit(EXIT_CODES.SUCCESS);
  } else {
    uiLogger.log(' ');
    uiLogger.log(commands.getStarted.logs.appSelected);

    const { dest, name } = await projectNameAndDestPrompt(args);

    const projectDest = path.resolve(getCwd(), dest);

    const {
      projectConfig: existingProjectConfig,
      projectDir: existingProjectDir,
    } = await getProjectConfig(projectDest);

    if (
      existingProjectConfig &&
      existingProjectDir &&
      projectDest.startsWith(existingProjectDir)
    ) {
      // Track nested project error
      await trackCommandMetadataUsage(
        'get-started',
        {
          successful: false,
          step: 'project-creation',
        },
        derivedAccountId
      );

      uiLogger.log(' ');
      uiLogger.error(
        commands.project.create.errors.cannotNestProjects(existingProjectDir)
      );
      process.exit(EXIT_CODES.ERROR);
    }

    // 4. Clone the project template from GitHub
    try {
      await cloneGithubRepo(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
        projectDest,
        {
          sourceDir: '2025.2/private-app-get-started-template',
          hideLogs: true,
        }
      );
      await trackCommandMetadataUsage(
        'get-started',
        {
          successful: true,
          step: 'github-clone',
        },
        derivedAccountId
      );
    } catch (err) {
      await trackCommandMetadataUsage(
        'get-started',
        {
          successful: false,
          step: 'github-clone',
        },
        derivedAccountId
      );

      debugError(err);
      uiLogger.log(' ');
      uiLogger.error(commands.project.create.errors.failedToDownloadProject);
      process.exit(EXIT_CODES.ERROR);
    }

    const projectConfigPath = path.join(projectDest, PROJECT_CONFIG_FILE);

    const parsedConfigFile: ProjectConfig = JSON.parse(
      fs.readFileSync(projectConfigPath).toString()
    );

    writeProjectConfig(projectConfigPath, {
      ...parsedConfigFile,
      name,
    });

    uiLogger.log(' ');
    uiLogger.success(commands.project.create.logs.success(name, projectDest));
    uiLogger.log(' ');
    uiLogger.log(commands.getStarted.prompts.projectCreated.title);
    uiLogger.log(' ');
    uiLogger.log(commands.getStarted.prompts.projectCreated.description);
    uiLogger.log(' ');

    // Track successful project creation
    await trackCommandMetadataUsage(
      'get-started',
      {
        successful: true,
        step: 'project-creation',
      },
      derivedAccountId
    );

    // 5. Install dependencies
    const installLocations = await getProjectPackageJsonLocations(projectDest);

    try {
      await installPackages({
        installLocations: installLocations,
      });
      uiLogger.log(' ');
      uiLogger.success(commands.getStarted.logs.dependenciesInstalled);
      uiLogger.log(' ');
    } catch (err) {
      uiLogger.log(' ');
      uiLogger.error(commands.getStarted.errors.installDepsFailed);
      logError(err);
      uiLogger.log(' ');
    }

    // 6. Ask user if they want to upload the project
    const { shouldUpload } = await promptUser<{ shouldUpload: boolean }>([
      {
        type: 'confirm',
        name: 'shouldUpload',
        message: commands.getStarted.prompts.uploadProject(accountName),
        default: true,
      },
    ]);

    // Track upload decision
    await trackCommandMetadataUsage(
      'get-started',
      {
        step: 'upload-decision',
        type: shouldUpload ? 'upload' : 'skip',
      },
      derivedAccountId
    );

    if (shouldUpload) {
      try {
        // Get the project config for the newly created project
        const { projectConfig: newProjectConfig, projectDir: newProjectDir } =
          await getProjectConfig(projectDest);

        if (!newProjectConfig || !newProjectDir) {
          // Track config file not found error
          await trackCommandMetadataUsage(
            'get-started',
            {
              successful: false,
              step: 'config-file-not-found',
            },
            derivedAccountId
          );

          uiLogger.log(' ');
          uiLogger.error(commands.getStarted.errors.configFileNotFound);
          process.exit(EXIT_CODES.ERROR);
        }

        validateProjectConfig(newProjectConfig, newProjectDir);

        uiLogger.log(' ');
        uiLogger.log(commands.getStarted.logs.uploadingProject);
        uiLogger.log(' ');

        const { result, uploadError } =
          await handleProjectUpload<ProjectPollResult>({
            accountId: derivedAccountId!,
            projectConfig: newProjectConfig,
            projectDir: newProjectDir,
            callbackFunc: pollProjectBuildAndDeploy,
            uploadMessage: 'Initial upload from get-started command',
            forceCreate: true, // Auto-create project on HubSpot
            isUploadCommand: false,
            sendIR: isV2Project(newProjectConfig.platformVersion),
            skipValidation: false,
          });

        if (uploadError) {
          // Track upload failure
          await trackCommandMetadataUsage(
            'get-started',
            {
              successful: false,
              step: 'upload',
            },
            derivedAccountId
          );

          uiLogger.log(' ');
          uiLogger.error(commands.getStarted.errors.uploadFailed);
          debugError(uploadError);
        } else if (result) {
          // Track successful upload completion
          await trackCommandMetadataUsage(
            'get-started',
            {
              successful: true,
              step: 'upload',
            },
            derivedAccountId
          );

          uiLogger.log(' ');
          uiLogger.success(commands.getStarted.logs.uploadSuccess);

          const {
            data: { results },
          } = await fetchPublicAppsForPortal(derivedAccountId!);

          const lastCreatedApp = results.sort(
            (a, b) => b.createdAt - a.createdAt
          )[0];

          if (process.env.BROWSER !== 'none') {
            uiLogger.log(' ');
            uiLogger.log(commands.getStarted.developerOverviewBrowserOpenPrep);
            uiLogger.log(' ');
            const { shouldOpenOverview } = await promptUser<{
              shouldOpenOverview: boolean;
            }>([
              {
                name: 'shouldOpenOverview',
                type: 'confirm',
                message: commands.getStarted.openInstallUrl,
              },
            ]);

            // Track Developer Overview browser action
            await trackCommandMetadataUsage(
              'get-started',
              {
                step: 'open-distribution-page',
                type: shouldOpenOverview ? 'opened' : 'declined',
              },
              derivedAccountId
            );

            if (shouldOpenOverview) {
              open(
                getStaticAuthAppInstallUrl({
                  targetAccountId: derivedAccountId!,
                  env: env,
                  appId: lastCreatedApp.id,
                }) + '&tourId=get-started',
                { url: true }
              );
              uiLogger.log(' ');
              uiLogger.success(commands.getStarted.openedDeveloperOverview);
            }
          }

          uiLogger.log(' ');
          uiFeatureHighlight(['projectDevCommand']);
        }
      } catch (err) {
        // Track upload exception
        await trackCommandMetadataUsage(
          'get-started',
          {
            successful: false,
            step: 'upload',
          },
          derivedAccountId
        );

        uiLogger.log(' ');
        uiLogger.error(commands.getStarted.errors.uploadFailed);
        debugError(err);
        process.exit(EXIT_CODES.ERROR);
      }
    }
  }

  // Track successful completion of get-started command
  await trackCommandMetadataUsage(
    'get-started',
    {
      successful: true,
      step: 'command-completed',
    },
    derivedAccountId
  );

  process.exit(EXIT_CODES.SUCCESS);
}

function getStartedBuilder(yargs: Argv): Argv<GetStartedArgs> {
  yargs.options({
    name: {
      describe: commands.getStarted.options.name.describe,
      type: 'string',
    },
    dest: {
      describe: commands.getStarted.options.dest.describe,
      type: 'string',
    },
    'template-source': {
      describe: commands.getStarted.options.templateSource.describe,
      type: 'string',
    },
  });
  return yargs as Argv<GetStartedArgs>;
}

const builder = makeYargsBuilder<GetStartedArgs>(
  getStartedBuilder,
  command,
  commands.getStarted.verboseDescribe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const getStartedCommand: YargsCommandModule<unknown, GetStartedArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default getStartedCommand;
