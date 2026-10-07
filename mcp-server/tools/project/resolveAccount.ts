import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpToolResponse } from '../../types.js';
import { McpLogger } from '../../utils/logger.js';
import { formatTextContents } from '../../utils/content.js';
import { enumField, requestElicitation } from '../../utils/elicitation.js';
import { discoverAccountTargets } from '../../../lib/accountTargetDiscovery.js';
import {
  AccountTargetCandidate,
  DiscoverAccountTargetsOptions,
} from '../../../types/AccountTargets.js';

function formatAccountChoice(candidate: AccountTargetCandidate): string {
  const name = candidate.accountName || String(candidate.accountId);
  const parts = [`${name} (${candidate.category})`];
  if (candidate.profileName) {
    parts.push(`[profile: ${candidate.profileName}]`);
  }
  return parts.join(' ');
}

function fallbackResponse(
  message: string,
  absoluteCurrentWorkingDirectory?: string
): Promise<McpToolResponse> {
  return absoluteCurrentWorkingDirectory
    ? formatTextContents(absoluteCurrentWorkingDirectory, message)
    : formatTextContents(message);
}

export type ResolveAccountResult =
  { accountId: number } | { response: McpToolResponse };

// Resolves the HubSpot account a tool should act on. Returns a numeric
// accountId when one is the obvious choice or the caller supplied a matching
// `account`. When several accounts are available and none is recommended, it
// asks the client to pick via elicitation. When the client cannot elicit (or
// declines), it returns a text response listing the candidates so the caller
// can return it directly. `toolName` names the tool in that fallback text.
export async function resolveAccountId(
  mcpServer: McpServer,
  logger: McpLogger,
  params: {
    toolName: string;
    absoluteCurrentWorkingDirectory?: string;
    account?: string;
    discoverOptions?: DiscoverAccountTargetsOptions;
  }
): Promise<ResolveAccountResult> {
  const { candidates, recommended } = await discoverAccountTargets({
    ...params.discoverOptions,
    explicitAccount: params.account,
  });
  const available = candidates ?? [];

  let accountId = recommended?.accountId;

  if (!accountId && params.account) {
    const match = available.find(
      candidate =>
        String(candidate.accountId) === params.account ||
        candidate.accountName === params.account
    );
    accountId = match?.accountId;
  }

  if (!accountId && available.length > 0) {
    const elicitation = await requestElicitation(
      mcpServer,
      {
        message: 'Select the HubSpot account to use.',
        fields: {
          account: enumField(
            'HubSpot account',
            'The account to use for this request.',
            available.map(candidate => String(candidate.accountId)),
            available.map(formatAccountChoice)
          ),
        },
        required: ['account'],
      },
      logger
    );
    if (elicitation?.action === 'accept' && elicitation.content) {
      accountId = Number(elicitation.content.account);
    }
  }

  if (!accountId) {
    if (available.length > 0) {
      return {
        response: await fallbackResponse(
          `Several HubSpot accounts are available. Ask the user which to use, then call ${params.toolName} again with the account argument set to one of: ${available
            .map(
              candidate =>
                `${formatAccountChoice(candidate)} (id ${candidate.accountId})`
            )
            .join(', ')}.`,
          params.absoluteCurrentWorkingDirectory
        ),
      };
    }
    return {
      response: await fallbackResponse(
        'No account ID found. Call the auth-account tool to authenticate a HubSpot account.',
        params.absoluteCurrentWorkingDirectory
      ),
    };
  }

  return { accountId };
}
