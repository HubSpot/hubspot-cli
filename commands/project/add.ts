import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  cloneGithubRepo,
  fetchReleaseData,
} from '@hubspot/local-dev-lib/github';
import { debugError } from '../../lib/errorHandlers';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { projectAddPrompt } from '../../lib/prompts/projectAddPrompt';
import { getProjectConfig } from '../../lib/projects';
import { getProjectComponentListFromRepo } from '../../lib/projects/create';
import { findProjectComponents } from '../../lib/projects/structure';
import { ComponentTypes } from '../../types/Projects';
import { uiBetaTag } from '../../lib/ui';
import { HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH } from '../../lib/constants';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { YargsCommandModule, CommonArgs } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const i18nKey = 'commands.project.subcommands.add';

const command = 'add';
const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

type ProjectAddArgs = CommonArgs & {
  type: string;
  name: string;
};

async function handler(
  args: ArgumentsCamelCase<ProjectAddArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('project-add', undefined, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectDir || !projectConfig) {
    logger.error(i18n(`${i18nKey}.error.locationInProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  // We currently only support adding private apps to projects
  let projectContainsPublicApp = false;
  try {
    const components = await findProjectComponents(projectDir);
    projectContainsPublicApp = components.some(
      c => c.type === ComponentTypes.PublicApp
    );
  } catch (err) {
    debugError(err);
  }

  if (projectContainsPublicApp) {
    logger.error(i18n(`${i18nKey}.error.projectContainsPublicApp`));
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log('');
  logger.log(
    i18n(`${i18nKey}.creatingComponent`, {
      projectName: projectConfig.name,
    })
  );
  logger.log('');

  let latestRepoReleaseTag;
  try {
    // We want the tag_name from the latest release of the components repo
    const repoReleaseData = await fetchReleaseData(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH
    );
    if (repoReleaseData) {
      latestRepoReleaseTag = repoReleaseData.tag_name;
    }
  } catch (err) {
    debugError(err);
  }

  if (!latestRepoReleaseTag) {
    logger.error(i18n(`${i18nKey}.error.failedToFetchComponentList`));
    process.exit(EXIT_CODES.ERROR);
  }

  const components =
    await getProjectComponentListFromRepo(latestRepoReleaseTag);

  if (!components.length) {
    logger.error(i18n(`${i18nKey}.error.failedToFetchComponentList`));
    process.exit(EXIT_CODES.ERROR);
  }

  const projectAddPromptResponse = await projectAddPrompt(components, args);

  try {
    const componentPath = path.join(
      projectDir,
      projectConfig.srcDir,
      projectAddPromptResponse.componentTemplate.insertPath,
      projectAddPromptResponse.name
    );

    await cloneGithubRepo(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
      componentPath,
      {
        sourceDir: projectAddPromptResponse.componentTemplate.path,
        tag: latestRepoReleaseTag,
        hideLogs: true,
      }
    );

    logger.log('');
    logger.success(
      i18n(`${i18nKey}.success`, {
        componentName: projectAddPromptResponse.name,
      })
    );
  } catch (error) {
    debugError(error);
    logger.error(i18n(`${i18nKey}.error.failedToDownloadComponent`));
    process.exit(EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function projectAddBuilder(yargs: Argv): Argv<ProjectAddArgs> {
  yargs.options({
    type: {
      describe: i18n(`${i18nKey}.options.type.describe`),
      type: 'string',
    },
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project add', i18n(`${i18nKey}.examples.default`)]]);
  yargs.example([
    [
      '$0 project add --name="my-component" --type="components/example-app"',
      i18n(`${i18nKey}.examples.withFlags`),
    ],
  ]);

  return yargs as Argv<ProjectAddArgs>;
}

const builder = makeYargsBuilder<ProjectAddArgs>(
  projectAddBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const projectAddCommand: YargsCommandModule<unknown, ProjectAddArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectAddCommand;
