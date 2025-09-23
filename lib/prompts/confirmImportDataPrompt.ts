import { getAccountConfig } from '@hubspot/local-dev-lib/config';

import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';

export async function confirmImportDataPrompt(
  targetAccountId: number,
  dataFileNames: string[]
): Promise<boolean> {
  const account = getAccountConfig(targetAccountId);
  const { confirmImportData } = await promptUser({
    type: 'confirm',
    name: 'confirmImportData',
    message: lib.prompts.confirmImportDataPrompt.message(
      dataFileNames,
      account
    ),
  });
  return confirmImportData;
}
