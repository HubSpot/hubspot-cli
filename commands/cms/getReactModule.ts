import { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { retrieveDefaultModule } from '@hubspot/local-dev-lib/cms/modules';
import { GithubRepoFile } from '@hubspot/local-dev-lib/types/Github';
import { i18n } from '../../lib/lang';
import { logError } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { listPrompt } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'get-react-module [name] [dest]';
const describe = i18n(`commands.cms.subcommands.getReactModule.describe`);

type GetReactModuleArgs = CommonArgs & {
  name?: string;
  dest?: string;
};

async function handler(args: ArgumentsCamelCase<GetReactModuleArgs>) {
  const { name, dest } = args;

  trackCommandUsage('get-react-modules');

  let moduleToRetrieve = name;

  if (!moduleToRetrieve) {
    let availableModules: GithubRepoFile[] | undefined;
    try {
      availableModules = await retrieveDefaultModule();
    } catch (e) {
      logError(e);
    }

    if (!availableModules) {
      process.exit(EXIT_CODES.ERROR);
    }

    const moduleChoice = await listPrompt(
      i18n(`commands.cms.subcommands.getReactModule.selectModulePrompt`),
      {
        choices: availableModules.map(module => module.name),
      }
    );
    moduleToRetrieve = moduleChoice;
  }

  const destPath = dest
    ? path.join(path.resolve(getCwd(), dest), `${moduleToRetrieve}`)
    : path.join(getCwd(), `${moduleToRetrieve}`);

  if (fs.existsSync(destPath)) {
    logger.error(
      i18n(`commands.cms.subcommands.getReactModule.errors.pathExists`, {
        path: destPath,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await retrieveDefaultModule(moduleToRetrieve, destPath);

    logger.success(
      i18n(`commands.cms.subcommands.getReactModule.success.moduleDownloaded`, {
        moduleName: moduleToRetrieve,
        path: destPath,
      })
    );
  } catch (e) {
    const isBadRequestError =
      (e as { cause?: { code?: string } })?.cause?.code === 'ERR_BAD_REQUEST';
    if (isBadRequestError) {
      logger.error(
        i18n(`commands.cms.subcommands.getReactModule.errors.invalidName`)
      );
    } else {
      logError(e);
    }
    process.exit(EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function cmsGetReactModuleBuilder(yargs: Argv): Argv<GetReactModuleArgs> {
  yargs.positional('name', {
    describe: i18n(
      `commands.cms.subcommands.getReactModule.positionals.name.describe`
    ),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(
      `commands.cms.subcommands.getReactModule.positionals.dest.describe`
    ),
    type: 'string',
  });
  return yargs as Argv<GetReactModuleArgs>;
}

const builder = makeYargsBuilder<GetReactModuleArgs>(
  cmsGetReactModuleBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const cmsGetReactModuleCommand: YargsCommandModule<
  unknown,
  GetReactModuleArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default cmsGetReactModuleCommand;
