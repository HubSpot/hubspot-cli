import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ACCOUNT_TARGET_CATEGORIES,
  AccountTargetCandidate,
  DiscoverAccountTargetsResult,
} from '../../../types/AccountTargets.js';
import { uiAccountDescription } from '../../../lib/ui/index.js';
import { McpToolResponse } from '../../types.js';
import { HubSpotCommand } from '../../utils/command.js';
import { formatErrorTextContents } from '../../utils/content.js';
import { canElicit, requestElicitation } from '../../utils/elicitation.js';
import { McpLogger } from '../../utils/logger.js';

// Sets the command to run against the account that was checked. hs rejects
// --profile with --account, and a profile already sets the account, so a
// profile wins.
export function setTargetAccount(
  command: HubSpotCommand,
  { recommended }: DiscoverAccountTargetsResult,
  profileName?: string
): void {
  if (profileName) {
    command.addFlag('profile', profileName);
    return;
  }

  if (recommended) {
    command.addFlag('account', recommended.accountId);
  }
}

// Without a recommended account the command can act on any candidate, so every
// production candidate is a possible target.
function getProductionTargets({
  candidates,
  recommended,
}: DiscoverAccountTargetsResult): AccountTargetCandidate[] {
  return (recommended ? [recommended] : candidates).filter(
    candidate =>
      candidate.category === ACCOUNT_TARGET_CATEGORIES.PRODUCTION_WITH_CARE
  );
}

// Returns an error response when the action must not run, or `undefined` when
// it can run. `confirmedInConversation` only counts when the client cannot show
// a confirmation form.
export async function confirmProductionTargets(
  mcpServer: McpServer,
  logger: McpLogger,
  {
    targets,
    action,
    toolName,
    confirmedInConversation,
  }: {
    targets: DiscoverAccountTargetsResult;
    action: string;
    toolName: string;
    confirmedInConversation?: boolean;
  }
): Promise<McpToolResponse | undefined> {
  const productionTargets = getProductionTargets(targets);
  if (productionTargets.length === 0) {
    return undefined;
  }

  const accounts = productionTargets
    .map(({ accountId }) => uiAccountDescription(accountId, false))
    .join(' or ');

  if (!canElicit(mcpServer)) {
    return confirmedInConversation
      ? undefined
      : formatErrorTextContents(
          `${action} targets production account ${accounts}, which is not a test account or sandbox. Ask the user to confirm this account. If the user confirms, call ${toolName} again with confirmProductionAccount set to true.`
        );
  }

  // A failed or timed-out request counts as a decline, so the flag cannot skip
  // the form.
  const elicitation = await requestElicitation(
    mcpServer,
    { message: `${action} to production account ${accounts}?`, fields: {} },
    logger
  );

  if (elicitation?.action === 'accept') {
    return undefined;
  }

  return formatErrorTextContents(
    `The user did not confirm production account ${accounts}, so ${toolName} did not run. Tell the user that the action was canceled. Do not ask the user to confirm again, and do not call ${toolName} again unless the user asks.`
  );
}
