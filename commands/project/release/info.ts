import { Argv, ArgumentsCamelCase } from 'yargs';
import { getReleaseInfo, listReleases } from '../../../api/releases.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { logError, ApiErrorContext } from '../../../lib/errorHandlers/index.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import { listPrompt } from '../../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';
import { renderTable } from '../../../ui/render.js';
import { makeWrappedYargsHandler } from '../../../lib/yargs/makeWrappedYargsHandler.js';
import { isPromptExitError } from '../../../lib/errors/PromptExitError.js';
import { mapToUserFacingType } from '@hubspot/project-parsing-lib/transform';
import { AUTO_GENERATED_COMPONENT_TYPES } from '@hubspot/project-parsing-lib/constants';

import {
  ReleaseJsonOutput,
  ReleaseSchema,
  mapReleaseToJsonOutput,
} from '../../../lib/jsonOutput.js';

const command = 'info';
// const describe = commands.project.release.info.describe;
const describe = undefined;
// const verboseDescribe = commands.project.release.info.verboseDescribe;
const verboseDescribe = undefined;

export type ProjectReleaseInfoArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<ReleaseJsonOutput> & {
    tag?: string;
  };

function normalizeTag(rawTag: string): string {
  return rawTag.startsWith('v') ? rawTag : `v${rawTag}`;
}

async function selectReleasePrompt(
  accountId: number,
  projectName: string
): Promise<string | null> {
  const {
    data: { results, paging },
  } = await listReleases(accountId, projectName);

  if (results.length === 0) {
    return null;
  }

  if (paging?.next?.after) {
    uiLogger.info(commands.project.release.info.moreReleasesHint);
  }

  return listPrompt<string>(
    commands.project.release.info.selectRelease(projectName),
    {
      choices: results.map(release => ({
        name: `${release.releaseTag} (build #${release.buildId}, ${new Date(release.createdAt).toLocaleString()})`,
        value: release.releaseTag,
      })),
    }
  );
}

async function handler(
  args: ArgumentsCamelCase<ProjectReleaseInfoArgs>
): Promise<void> {
  const {
    derivedAccountId,
    tag: rawTag,
    json: formatOutputAsJson,
    exit,
    addJsonOutput,
  } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }

  const projectName = projectConfig.name;

  let tag: string;

  if (rawTag) {
    tag = normalizeTag(rawTag);
  } else {
    try {
      const selected = await selectReleasePrompt(derivedAccountId, projectName);
      if (!selected) {
        uiLogger.error(commands.project.release.info.errors.noReleases);
        return exit(EXIT_CODES.ERROR);
      }
      tag = selected;
    } catch (e) {
      if (isPromptExitError(e)) {
        throw e;
      }
      logError(e);
      return exit(EXIT_CODES.ERROR);
    }
  }

  try {
    const { data: release } = await getReleaseInfo(
      derivedAccountId,
      projectName,
      tag
    );

    addJsonOutput(mapReleaseToJsonOutput(release));
    if (!formatOutputAsJson) {
      uiLogger.log(
        commands.project.release.info.releaseDetails(
          release.releaseTag,
          projectName
        )
      );

      renderTable(
        ['Release', 'Build', 'Created'],
        [
          [
            release.releaseTag,
            `#${release.buildId}`,
            new Date(release.createdAt).toLocaleString(),
          ],
        ]
      );

      const visibleComponents = (release.components ?? []).filter(
        component =>
          !AUTO_GENERATED_COMPONENT_TYPES.includes(component.buildType)
      );

      if (visibleComponents.length > 0) {
        uiLogger.log('');
        uiLogger.log(commands.project.release.info.components);

        const componentRows = visibleComponents.map(component => [
          mapToUserFacingType(component.buildType),
          component.buildName ?? '',
          component.rootPath ?? '',
        ]);

        renderTable(['Type', 'Name', 'Path'], componentRows);
      } else {
        uiLogger.log('');
        uiLogger.log(commands.project.release.info.noComponents);
      }
    }
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 404) {
      uiLogger.error(
        commands.project.release.info.errors.releaseNotFound(tag, projectName)
      );
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          request: 'project release info',
        })
      );
    }
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
}

function projectReleaseInfoBuilder(yargs: Argv): Argv<ProjectReleaseInfoArgs> {
  yargs.options({
    tag: {
      describe: commands.project.release.info.options.tag,
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project release info --tag=v1.0.0',
      commands.project.release.info.examples.default,
    ],
    [
      '$0 project release info --tag=v1.0.0 --json',
      commands.project.release.info.examples.json,
    ],
  ]);

  return yargs as Argv<ProjectReleaseInfoArgs>;
}

const builder = makeYargsBuilder<ProjectReleaseInfoArgs>(
  projectReleaseInfoBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useJSONOutputOptions: true,
  }
);

const projectReleaseInfoCommand: YargsCommandModule<
  unknown,
  ProjectReleaseInfoArgs
> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('project-release-info', handler, {
    jsonOutputSchema: ReleaseSchema,
  }),
};

export default projectReleaseInfoCommand;
