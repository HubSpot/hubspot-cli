import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { renderInline } from '../../ui/render.js';
import { getWarningBox } from '../../ui/components/StatusMessageBoxes.js';
import { commands } from '../../lang/en.js';
import { isV2Project } from '../../lib/projects/platformVersion.js';
import { isPromptExitError } from '../../lib/errors/PromptExitError.js';
import {
  resolveProjectName,
  checkDeployedComponents,
  deleteDeployedComponents,
  confirmDeletion,
  handleProjectDeletion,
} from '../../lib/projects/delete.js';

const command = 'delete';
const describe = commands.project.delete.describe;
const verboseDescribe = commands.project.delete.verboseDescribe;

export type ProjectDeleteArgs = CommonArgs &
  ConfigArgs &
  AccountArgs & {
    projectName?: string;
    force: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectDeleteArgs>
): Promise<void> {
  const { derivedAccountId, projectName: projectNameArg, force, exit } = args;

  await renderInline(
    getWarningBox({
      title: commands.project.delete.warnings.irreversibleTitle,
      message: commands.project.delete.warnings.irreversible,
    })
  );

  try {
    const projectName = await resolveProjectName(
      derivedAccountId,
      projectNameArg
    );

    const { platformVersion, hasUnifiedComponents, projectId } =
      await checkDeployedComponents(derivedAccountId, projectName);

    if (!force) {
      await confirmDeletion(projectName, derivedAccountId, projectId);
    }

    if (isV2Project(platformVersion) && hasUnifiedComponents) {
      await deleteDeployedComponents(derivedAccountId, projectName);
    }

    await handleProjectDeletion(derivedAccountId, projectName);
  } catch (e) {
    if (isPromptExitError(e)) {
      throw e;
    }
    logError(e);
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
}

function projectDeleteBuilder(yargs: Argv): Argv<ProjectDeleteArgs> {
  yargs.option('project-name', {
    describe: commands.project.delete.options.project,
    type: 'string',
  });

  yargs.option('force', {
    describe: commands.project.delete.options.force,
    type: 'boolean',
    default: false,
  });

  yargs.example([
    [
      '$0 project delete --project-name=my-project',
      'Delete a project in the current account named "my-project"',
    ],
    [
      '$0 project delete --project-name=my-project --force',
      'Delete and skip confirmation prompt',
    ],
  ]);

  return yargs as Argv<ProjectDeleteArgs>;
}

const builder = makeYargsBuilder<ProjectDeleteArgs>(
  projectDeleteBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const projectDeleteCommand: YargsCommandModule<unknown, ProjectDeleteArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('project-delete', handler),
  builder,
};

export default projectDeleteCommand;
