import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import { CommonArgs, ConfigArgs } from './Yargs.js';
import { ArgumentsCamelCase } from 'yargs';

export type LinkArgs = CommonArgs & ConfigArgs;

export type LinkContext = {
  globalAccountsList: HubSpotConfigAccount[];
  globalDefaultAccount: HubSpotConfigAccount | undefined;
  accountOverrideId: number | null;
  preselectedAccountId?: number;
};

export const ACTION_RESULT_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  NOOP: 'noop',
} as const;

export type ActionResult =
  | { status: typeof ACTION_RESULT_STATUS.SUCCESS; settings: HsSettingsFile }
  | { status: typeof ACTION_RESULT_STATUS.ERROR; reason: string }
  | { status: typeof ACTION_RESULT_STATUS.NOOP };

export type ActionHandlerParams = {
  state: HsSettingsFile;
  context: LinkContext;
  args: ArgumentsCamelCase<LinkArgs>;
};

export type ActionHandler = (
  params: ActionHandlerParams
) => Promise<ActionResult>;

export type ActionName = 'link' | 'unlink' | 'authenticate' | 'cancel';
