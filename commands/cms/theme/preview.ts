import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { commands } from '../../../lang/en.js';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { getThemeJSONPath } from '@hubspot/local-dev-lib/cms/themes';
import { spawnDevServer } from '../../../lib/theme/cmsDevServerProcess.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import {
  previewPrompt,
  previewProjectPrompt,
} from '../../../lib/prompts/previewPrompt.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { findProjectComponents } from '../../../lib/projects/structure.js';
import { ComponentTypes } from '../../../types/Projects.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { uiLogger } from '../../../lib/ui/logger.js';

const command = 'preview [--src] [--dest]';
const describe = commands.cms.subcommands.theme.subcommands.preview.describe;

export type ThemePreviewArgs = CommonArgs &
  ConfigArgs &
  AccountArgs & {
    src: string;
    dest: string;
    'no-ssl'?: boolean;
    port?: number;
    resetSession?: boolean;
    generateFieldsTypes?: boolean;
  };

function validateSrcPath(src: string): boolean {
  const logInvalidPath = () => {
    uiLogger.error(
      commands.cms.subcommands.theme.subcommands.preview.errors.invalidPath(src)
    );
  };
  try {
    const stats = fs.statSync(src);
    if (!stats.isDirectory()) {
      logInvalidPath();
      return false;
    }
  } catch (e) {
    logInvalidPath();
    return false;
  }
  return true;
}

async function determineSrcAndDest(args: ThemePreviewArgs): Promise<{
  absoluteSrc: string;
  dest: string;
}> {
  let absoluteSrc;
  let dest;
  const { projectDir, projectConfig } = await getProjectConfig();
  if (!(projectDir && projectConfig)) {
    // Not in a project, prompt for src and dest of traditional theme
    const previewPromptAnswers = await previewPrompt(args);
    const src = args.src || previewPromptAnswers.src;
    dest = args.dest || previewPromptAnswers.dest;
    absoluteSrc = path.resolve(getCwd(), src);
    if (!dest || !validateSrcPath(absoluteSrc)) {
      throw new Error(
        commands.cms.subcommands.theme.subcommands.preview.errors.invalidPath(
          src
        )
      );
    }
  } else {
    // In a project
    let themeJsonPath = getThemeJSONPath(getCwd());
    if (!themeJsonPath) {
      const projectComponents = await findProjectComponents(projectDir);
      const themeComponents = projectComponents.filter(
        c => c.type === ComponentTypes.HublTheme
      );
      if (themeComponents.length === 0) {
        throw new Error(
          commands.cms.subcommands.theme.subcommands.preview.errors
            .noThemeComponents
        );
      }
      const answer = await previewProjectPrompt(themeComponents);
      themeJsonPath = `${answer.themeComponentPath}/theme.json`;
    }
    const { dir: themeDir } = path.parse(themeJsonPath);
    absoluteSrc = themeDir;
    const { base: themeName } = path.parse(themeDir);
    dest = `@projects/${projectConfig.name}/${themeName}`;
  }
  return { absoluteSrc, dest };
}

async function handler(
  args: ArgumentsCamelCase<ThemePreviewArgs>
): Promise<void> {
  const {
    derivedAccountId,
    noSsl,
    resetSession,
    port,
    generateFieldsTypes,
    exit,
  } = args;

  let absoluteSrc: string;
  let dest: string;
  try {
    ({ absoluteSrc, dest } = await determineSrcAndDest(args));
  } catch (error) {
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }

  // Spawn dev server in isolated subprocess to avoid React version conflicts
  // File listing and progress bars are handled within the subprocess
  await spawnDevServer({
    absoluteSrc,
    accountName: derivedAccountId?.toString(),
    noSsl,
    port,
    generateFieldsTypes,
    resetSession: resetSession || false,
    dest,
    exit,
  });
}

function themePreviewBuilder(yargs: Argv): Argv<ThemePreviewArgs> {
  yargs
    .option('src', {
      describe:
        commands.cms.subcommands.theme.subcommands.preview.positionals.src,
      type: 'string',
      requiresArg: true,
    })
    .option('dest', {
      describe:
        commands.cms.subcommands.theme.subcommands.preview.positionals.dest,
      type: 'string',
      requiresArg: true,
    })
    .option('no-ssl', {
      describe:
        commands.cms.subcommands.theme.subcommands.preview.options.noSsl,
      type: 'boolean',
    })
    .option('port', {
      describe: commands.cms.subcommands.theme.subcommands.preview.options.port,
      type: 'number',
    })
    .option('reset-session', {
      hidden: true,
      type: 'boolean',
    })
    .option('generate-fields-types', {
      hidden: true,
      type: 'boolean',
    });

  return yargs as Argv<ThemePreviewArgs>;
}

const builder = makeYargsBuilder<ThemePreviewArgs>(
  themePreviewBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const themePreviewCommand: YargsCommandModule<unknown, ThemePreviewArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('preview', handler),
  builder,
};

export default themePreviewCommand;
