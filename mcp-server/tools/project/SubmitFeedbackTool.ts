import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import { McpLogger } from '../../utils/logger.js';
import { McpToolResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import { formatTextContents } from '../../utils/content.js';
import { getToolErrorMessage } from '../../utils/errors.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { absoluteCurrentWorkingDirectory, account } from './constants.js';
import { resolveAccountId } from './resolveAccount.js';
import {
  containsAccountCredentials,
  submitFeedback,
} from '../../../lib/feedback.js';
import { FEEDBACK_SOURCES } from '../../../api/feedback.js';
import { MAX_FEEDBACK_LENGTH } from '../../../lib/constants.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  account,
  feedback: z
    .string()
    .trim()
    .min(1)
    .max(MAX_FEEDBACK_LENGTH)
    .describe(
      'One short message that describes the problem or the request. Keep it about the HubSpot CLI, these tools, or the developer platform. Do not include secrets, access keys, file contents, or personal data.'
    ),
  source: z
    .enum(FEEDBACK_SOURCES)
    .describe(
      'Who the feedback is from. Use "user" when you pass on feedback that the user gave you, or "agent" when the feedback is your own.'
    ),
};

type InputSchemaType = z.infer<z.ZodObject<typeof inputSchema>>;

const toolName: string = 'submit-feedback';

export class SubmitFeedbackTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  protected getTrackingMeta({
    source,
  }: InputSchemaType): { [key: string]: string } | undefined {
    return { mode: source };
  }

  protected getLoggableInput({ feedback, ...input }: InputSchemaType): unknown {
    return { ...input, feedbackLength: feedback.length };
  }

  async handler({
    absoluteCurrentWorkingDirectory,
    account,
    feedback,
    source,
  }: InputSchemaType): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    try {
      const resolved = await resolveAccountId(this.mcpServer, this.logger, {
        toolName,
        account,
      });
      if ('response' in resolved) {
        return resolved.response;
      }

      if (containsAccountCredentials(feedback)) {
        return formatTextContents(
          'Feedback cannot contain an access key, token, or secret from your HubSpot config. Remove it, then try again.'
        );
      }

      await submitFeedback(resolved.accountId, feedback, source);
      return formatTextContents(
        'Your feedback has been successfully submitted. Tell the user that you sent feedback, and show them the message.'
      );
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: getErrorMessage(error),
      });
      return formatTextContents(
        `Error sending feedback: ${getToolErrorMessage(error)}`
      );
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Submit Feedback',
        description:
          'Sends feedback to HubSpot about the HubSpot CLI, these tools, or the HubSpot developer platform. Use it for bugs and errors you hit, things you wish you knew before you started, things that confused or frustrated the user, requests you could not complete, and tools or capabilities that would make future tasks easier. Send one short message, then continue with the task.',
        inputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
