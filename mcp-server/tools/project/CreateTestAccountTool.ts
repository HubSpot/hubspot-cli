import { z } from 'zod';
import fs from 'fs';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { formatTextContents, formatTextContent } from '../../utils/content.js';
import { addFlag } from '../../utils/command.js';
import { runCommandInDir } from '../../utils/command.js';
import {
  ACCOUNT_LEVELS,
  ACCOUNT_LEVEL_CHOICES,
} from '../../../lib/constants.js';
import { TextContent, TextContentResponse, Tool } from '../../types.js';
import { absoluteCurrentWorkingDirectory } from './constants.js';
import { DeveloperTestAccountConfig } from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { getConfigAccountByName } from '@hubspot/local-dev-lib/config';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const ACCOUNT_LEVEL_CHOICES_WITHOUT_STARTER = [
  ACCOUNT_LEVELS.FREE,
  ACCOUNT_LEVELS.PROFESSIONAL,
  ACCOUNT_LEVELS.ENTERPRISE,
] as const;

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  configPath: z
    .string()
    .optional()
    .describe(
      'Path to a test account configuration JSON file. Mutually exclusive with all other parameters.\n\n' +
        'Config file format:\n' +
        '{\n' +
        '  "accountName": "AllHubsProfessional",\n' +
        '  "description": "Professional test account",\n' +
        '  "marketingLevel": "PROFESSIONAL",\n' +
        '  "opsLevel": "PROFESSIONAL",\n' +
        '  "serviceLevel": "PROFESSIONAL",\n' +
        '  "salesLevel": "PROFESSIONAL",\n' +
        '  "contentLevel": "PROFESSIONAL"\n' +
        '}'
    ),
  name: z
    .string()
    .optional()
    .describe('Name for the test account. Required when not using configPath.'),
  description: z
    .string()
    .optional()
    .describe(
      'Description for the test account. Required when not using configPath.'
    ),
  marketingLevel: z
    .enum(ACCOUNT_LEVEL_CHOICES)
    .optional()
    .describe(
      `Marketing Hub tier level. Options: ${ACCOUNT_LEVEL_CHOICES.join(', ')}. Defaults to ENTERPRISE if not specified.`
    ),
  opsLevel: z
    .enum(ACCOUNT_LEVEL_CHOICES)
    .optional()
    .describe(
      `Operations Hub tier level. Options: ${ACCOUNT_LEVEL_CHOICES.join(', ')}. Defaults to ENTERPRISE if not specified.`
    ),
  serviceLevel: z
    .enum(ACCOUNT_LEVEL_CHOICES)
    .optional()
    .describe(
      `Service Hub tier level. Options: ${ACCOUNT_LEVEL_CHOICES.join(', ')}. Defaults to ENTERPRISE if not specified.`
    ),
  salesLevel: z
    .enum(ACCOUNT_LEVEL_CHOICES)
    .optional()
    .describe(
      `Sales Hub tier level. Options: ${ACCOUNT_LEVEL_CHOICES.join(', ')}. Defaults to ENTERPRISE if not specified.`
    ),
  contentLevel: z
    .enum(ACCOUNT_LEVEL_CHOICES)
    .optional()
    .describe(
      `CMS Hub tier level. Options: ${ACCOUNT_LEVEL_CHOICES.join(', ')}. Defaults to ENTERPRISE if not specified.`
    ),
  commerceLevel: z
    .enum(ACCOUNT_LEVEL_CHOICES_WITHOUT_STARTER)
    .optional()
    .describe(
      `Commerce Hub tier level. Options: ${ACCOUNT_LEVEL_CHOICES_WITHOUT_STARTER.join(', ')}. Defaults to ENTERPRISE if not specified.`
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createTestAccountInputSchema = z.object({ ...inputSchema });

export type CreateTestAccountInputSchema = z.infer<
  typeof createTestAccountInputSchema
>;

const toolName: string = 'create-test-account';
export class CreateTestAccountTool extends Tool<CreateTestAccountInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    absoluteCurrentWorkingDirectory,
    name,
    description,
    marketingLevel,
    opsLevel,
    serviceLevel,
    salesLevel,
    contentLevel,
    commerceLevel,
    configPath,
  }: CreateTestAccountInputSchema): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);
    await trackToolUsage(toolName);

    let command = 'hs test-account create';

    const content: TextContent[] = [];

    // Use config file if provided (LLM should check for config first)
    if (configPath) {
      let configJson: DeveloperTestAccountConfig;
      try {
        const config = fs.readFileSync(configPath, 'utf8');
        configJson = JSON.parse(config) as DeveloperTestAccountConfig;
      } catch (error) {
        return {
          content: [
            formatTextContent(
              `Failed to read or parse config file at "${configPath}": ${getErrorMessage(error)}. Please ensure the file exists and contains valid JSON.`
            ),
          ],
        };
      }

      if (configJson.accountName) {
        try {
          if (getConfigAccountByName(configJson.accountName)) {
            content.push(
              formatTextContent(
                `The account name "${configJson.accountName}" already exists in the CLI config. Please use a different name.`
              )
            );
          }
        } catch (error) {
          // nothing to do here
        }
      }

      command = addFlag(command, 'config-path', configPath);
    }
    // Use flags if name is provided (when no config used)
    else if (name) {
      try {
        if (getConfigAccountByName(name)) {
          content.push(
            formatTextContent(
              `The account name "${name}" already exists in the CLI config. Please use a different name.`
            )
          );
        }
      } catch (e) {
        // nothing to do here
      }

      command = addFlag(command, 'name', name);
      command = addFlag(command, 'description', description || name);
      command = addFlag(
        command,
        'marketing-level',
        marketingLevel || 'ENTERPRISE'
      );
      command = addFlag(command, 'ops-level', opsLevel || 'ENTERPRISE');
      command = addFlag(command, 'service-level', serviceLevel || 'ENTERPRISE');
      command = addFlag(command, 'sales-level', salesLevel || 'ENTERPRISE');
      command = addFlag(command, 'content-level', contentLevel || 'ENTERPRISE');
      command = addFlag(
        command,
        'commerce-level',
        commerceLevel || 'ENTERPRISE'
      );
    } else {
      content.push(
        formatTextContent(
          `Ask the user for the account config JSON path or the name of the test account to create.`
        )
      );
    }

    if (content.length > 0) {
      return {
        content,
      };
    }

    // No flags or config - command will prompt user interactively

    try {
      const { stdout, stderr } = await runCommandInDir(
        absoluteCurrentWorkingDirectory,
        command
      );

      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        stdout,
        stderr
      );
    } catch (error) {
      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        getErrorMessage(error)
      );
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Create HubSpot Test Account',
        description:
          'Creates a HubSpot developer test account. Test accounts are temporary HubSpot portals used for local development, testing apps, and QA workflows.\n\n' +
          'WORKFLOW:\n' +
          '1. Check the current working directory for existing test account config files (e.g., test-account.json, test-portal-config.json)\n' +
          '2. If config file found:\n' +
          '   - Show the user what file(s) you found\n' +
          '   - Ask if they want to use the existing config\n' +
          '   - If YES: Use configPath parameter only\n' +
          '   - If NO: Proceed to step 3\n' +
          '3. If no config file OR user declined:\n' +
          '   - Ask the user for ALL account details:\n' +
          '     * Account name (required)\n' +
          '     * Description (optional, defaults to account name if not specified)\n' +
          '     * Hub tier levels for each hub (optional, default to ENTERPRISE if not specified)\n' +
          '   - Call this tool with name, description, and all tier level parameters\n' +
          '   - IMPORTANT: Always provide all parameters to ensure non-interactive execution\n\n' +
          'Available Hub Tier Levels: FREE, STARTER, PROFESSIONAL, ENTERPRISE\n' +
          'Available Hubs: Marketing (marketingLevel), Sales (salesLevel), Service (serviceLevel), Operations (opsLevel), CMS (contentLevel), Commerce (commerceLevel)',
        inputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      this.handler
    );
  }
}
