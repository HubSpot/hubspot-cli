import { http } from '@hubspot/local-dev-lib/http';
import { http as unauthedHttp } from '@hubspot/local-dev-lib/http/unauthed';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';

const USAGE_PATH = 'local/dev/tools/proxy/v1/usage';
const USAGE_AUTHENTICATED_PATH = `${USAGE_PATH}/authenticated`;

export type ConfigType = 'local' | 'global';
export type ExecutionSource = 'ci' | 'mcp' | 'user';

export type UsageTrackingMeta = {
  action?: string; // "The specific action taken in the CLI"
  os?: string; // "The user's OS"
  nodeVersion?: string; // "The user's version of node.js"
  nodeMajorVersion?: string; // "The user's major version of node.js"
  version?: string; // "The user's version of the CLI"
  command?: string; // "The specific command that the user ran in this interaction"
  authType?: string; // "The configured auth type the user has for the CLI"
  step?: string; // "The specific step in the process"
  assetType?: string; // "The asset type"
  mode?: string; // "The CMS publish mode (draft or publish)"
  type?: string | number; // "The upload type"
  file?: boolean; // "Whether or not the 'file' flag was used"
  successful?: boolean; // "Whether or not the CLI interaction was successful"
  configType?: ConfigType; // "Whether the user's config is local or global"
  executionSource?: ExecutionSource; // "How the CLI command was triggered"
  platformVersion?: string; // "The platform version of the project"
  executionTime?: number; // "The duration of the command execution in milliseconds"
};

export type UsageTrackingRequest = {
  portalId?: number;
  accountId?: number;
  eventName: string;
  eventClass: string;
  meta: UsageTrackingMeta;
};

export async function sendUsageEvent(
  request: UsageTrackingRequest
): Promise<void> {
  const { accountId } = request;

  if (accountId) {
    try {
      const account = getConfigAccountById(accountId);
      if (account?.authType === 'personalaccesskey') {
        await http.post(accountId, {
          url: USAGE_AUTHENTICATED_PATH,
          data: request,
        });
        return;
      }
    } catch (_e) {}
  }

  try {
    await unauthedHttp.post({
      url: USAGE_PATH,
      data: request,
    });
  } catch (_e) {}
}
