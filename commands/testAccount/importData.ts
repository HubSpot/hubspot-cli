import { ArgumentsCamelCase, Argv } from 'yargs';

import { getImportDataRequest } from '@hubspot/local-dev-lib/crm';

import { logError } from '../../lib/errorHandlers/index.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { importDataFilePathPrompt } from '../../lib/prompts/importDataFilePathPrompt.js';
import {
  handleImportData,
  handleTargetTestAccountSelectionFlow,
} from '../../lib/importData.js';
import { confirmImportDataPrompt } from '../../lib/prompts/confirmImportDataPrompt.js';
import { commands } from '../../lang/en.js';

export const command = 'import-data';
export const describe = commands.testAccount.subcommands.importData.describe;

type CrmImportDataArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    filePath: string | undefined;
    skipConfirm: boolean | undefined;
  };

async function handler(
  args: ArgumentsCamelCase<CrmImportDataArgs>
): Promise<void> {
  const {
    derivedAccountId,
    userProvidedAccount,
    filePath: providedFilePath,
    skipConfirm,
  } = args;

  trackCommandUsage('crm-import-data', {}, derivedAccountId);

  let targetAccountId: number;

  try {
    targetAccountId = await handleTargetTestAccountSelectionFlow(
      derivedAccountId,
      userProvidedAccount
    );

    const filePath = providedFilePath || (await importDataFilePathPrompt());
    const { importRequest, dataFileNames } = getImportDataRequest(filePath);

    const confirmImportData =
      skipConfirm ||
      (await confirmImportDataPrompt(targetAccountId, dataFileNames));

    if (!confirmImportData) {
      process.exit(EXIT_CODES.SUCCESS);
    }

    await handleImportData(targetAccountId, dataFileNames, importRequest);
  } catch (error) {
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function crmImportDataBuilder(yargs: Argv): Argv<CrmImportDataArgs> {
  yargs.example([['$0 test-account import-data']]);

  yargs.options({
    'file-path': {
      type: 'string',
      describe:
        commands.testAccount.subcommands.importData.options.filePath.describe,
      positional: false,
    },
    'skip-confirm': {
      type: 'boolean',
      describe:
        commands.testAccount.subcommands.importData.options.skipConfirm
          .describe,
    },
  });

  return yargs as Argv<CrmImportDataArgs>;
}

const builder = makeYargsBuilder<CrmImportDataArgs>(
  crmImportDataBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);
const crmImportDataCommand: YargsCommandModule<unknown, CrmImportDataArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default crmImportDataCommand;
