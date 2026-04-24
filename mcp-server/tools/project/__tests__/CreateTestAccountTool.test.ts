import {
  CreateTestAccountInputSchema,
  CreateTestAccountTool,
} from '../CreateTestAccountTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { runCommandInDir } from '../../../utils/command.js';
import { addFlag } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import fs from 'fs';
import * as config from '@hubspot/local-dev-lib/config';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/command');
vi.mock('../../../utils/feedbackTracking');
vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/config');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockAddFlag = addFlag as MockedFunction<typeof addFlag>;
const mockReadFileSync = fs.readFileSync as MockedFunction<
  typeof fs.readFileSync
>;
const mockGetConfigAccountByName = vi.spyOn(config, 'getConfigAccountByName');

describe('mcp-server/tools/project/CreateTestAccountTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: CreateTestAccountTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    // @ts-expect-error Not mocking the whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    // @ts-expect-error Not mocking the whole thing
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);
    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new CreateTestAccountTool(mockMcpServer, mockLogger);

    // Mock addFlag to simulate command building
    mockAddFlag.mockImplementation(
      (command, flag, value) => `${command} --${flag} "${value}"`
    );

    // Mock fs.readFileSync for config file tests
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        accountName: 'TestAccountFromConfig',
        description: 'Test description',
        marketingLevel: 'PROFESSIONAL',
      })
    );

    // @ts-expect-error breaking things
    mockGetConfigAccountByName.mockReturnValue(undefined);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'create-test-account',
        expect.objectContaining({
          title: 'Create HubSpot Test Account',
          description: expect.stringContaining(
            'Creates a HubSpot developer test account'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    describe('config file approach', () => {
      const baseInput: CreateTestAccountInputSchema = {
        absoluteCurrentWorkingDirectory: '/test/workspace',
        configPath: './test-account.json',
        description: 'Test account',
        marketingLevel: 'ENTERPRISE',
        opsLevel: 'ENTERPRISE',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'ENTERPRISE',
        contentLevel: 'ENTERPRISE',
        commerceLevel: 'ENTERPRISE',
      };

      it('should create test account with config path', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created successfully\nAccount ID: 12345678',
          stderr: '',
        });

        const result = await tool.handler(baseInput);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'config-path',
          './test-account.json'
        );

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          'hs test-account create --config-path "./test-account.json"'
        );

        expect(result).toEqual({
          content: [
            { type: 'text', text: '/test/workspace' },
            {
              type: 'text',
              text: 'Test account created successfully\nAccount ID: 12345678',
            },
            { type: 'text', text: '' },
          ],
        });
      });

      it('should handle absolute config path', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          configPath: '/absolute/path/to/config.json',
          description: 'Test account',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'config-path',
          '/absolute/path/to/config.json'
        );

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          'hs test-account create --config-path "/absolute/path/to/config.json"'
        );
      });

      it('should prioritize config path over flags', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          configPath: './test-account.json',
          name: 'FlagAccount',
          description: 'This should be ignored',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'config-path',
          './test-account.json'
        );

        // Should not call addFlag for name or description
        expect(mockAddFlag).not.toHaveBeenCalledWith(
          expect.anything(),
          'name',
          expect.anything()
        );
      });

      it('should return helpful error when config file does not exist', async () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error(
            "ENOENT: no such file or directory, open './missing-config.json'"
          );
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          configPath: './missing-config.json',
        };

        const result = await tool.handler(input);

        expect(mockRunCommandInDir).not.toHaveBeenCalled();
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining(
                'Failed to read or parse config file at "./missing-config.json"'
              ),
            },
          ],
        });
        expect(result.content[0]).toHaveProperty(
          'text',
          expect.stringContaining(
            'Please ensure the file exists and contains valid JSON'
          )
        );
      });

      it('should return helpful error when config file contains invalid JSON', async () => {
        mockReadFileSync.mockReturnValue('{ invalid json }');

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          configPath: './invalid-config.json',
        };

        const result = await tool.handler(input);

        expect(mockRunCommandInDir).not.toHaveBeenCalled();
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: expect.stringContaining(
                'Failed to read or parse config file at "./invalid-config.json"'
              ),
            },
          ],
        });
      });
    });

    describe('flag-based approach', () => {
      it('should create test account with name and all defaults', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created successfully',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'MyTestAccount',
          description: '',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'MyTestAccount'
        );
      });

      it('should add all flags with defaults when only name is provided', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created successfully',
          stderr: '',
        });

        const input = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'MyTestAccount',
        } as CreateTestAccountInputSchema;

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'MyTestAccount'
        );
        // Implementation uses name as fallback for description, and adds all hub levels with ENTERPRISE defaults
        expect(mockAddFlag).toHaveBeenCalledTimes(8);

        expect(mockRunCommandInDir).toHaveBeenCalled();
      });

      it('should create test account with account name and description', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'MyTestAccount',
          description: 'Test account for development',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'MyTestAccount'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.stringContaining('name'),
          'description',
          'Test account for development'
        );
      });

      it('should create test account with specific hub levels', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'MixedTierAccount',
          description: 'Test account',
          marketingLevel: 'PROFESSIONAL',
          salesLevel: 'STARTER',
          contentLevel: 'FREE',
          commerceLevel: 'FREE',
          serviceLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'MixedTierAccount'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.stringContaining('name'),
          'marketing-level',
          'PROFESSIONAL'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.stringContaining('marketing-level'),
          'sales-level',
          'STARTER'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.stringContaining('sales-level'),
          'content-level',
          'FREE'
        );
      });

      it('should create test account with all hub levels specified', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'AllHubsAccount',
          description: 'Full configuration',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'PROFESSIONAL',
          serviceLevel: 'STARTER',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'PROFESSIONAL',
          commerceLevel: 'FREE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'AllHubsAccount'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'description',
          'Full configuration'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'marketing-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'ops-level',
          'PROFESSIONAL'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'service-level',
          'STARTER'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'sales-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'content-level',
          'PROFESSIONAL'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'commerce-level',
          'FREE'
        );
      });
    });

    describe('handler defaults', () => {
      it('should use ENTERPRISE defaults for all hub levels when not specified', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'DefaultLevelsAccount',
          description: '',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'DefaultLevelsAccount'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'marketing-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'ops-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'service-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'sales-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'content-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'commerce-level',
          'ENTERPRISE'
        );
      });

      it('should use name as fallback for description when description is empty', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'NoDescriptionAccount',
          description: '',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'NoDescriptionAccount'
        );
        // Implementation uses name as fallback for description
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'description',
          'NoDescriptionAccount'
        );
      });

      it('should use defaults for some hub levels while respecting explicit values', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'PartialLevelsAccount',
          description: '',
          marketingLevel: 'FREE',
          salesLevel: 'STARTER',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'PartialLevelsAccount'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'marketing-level',
          'FREE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'sales-level',
          'STARTER'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'ops-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'service-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'content-level',
          'ENTERPRISE'
        );
        expect(mockAddFlag).toHaveBeenCalledWith(
          expect.any(String),
          'commerce-level',
          'ENTERPRISE'
        );
      });

      it('should add all hub level flags when defaults are applied', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created with defaults',
          stderr: '',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'MinimalAccount',
          description: '',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        const result = await tool.handler(input);

        expect(mockRunCommandInDir).toHaveBeenCalled();
        expect(mockAddFlag).toHaveBeenCalledTimes(8);
        expect(result.content[1]).toEqual({
          type: 'text',
          text: 'Test account created with defaults',
        });
      });

      it('should use ENTERPRISE defaults when values are undefined', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created',
          stderr: '',
        });

        const input = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'BypassedDefaultsAccount',
        } as CreateTestAccountInputSchema;

        await tool.handler(input);

        expect(mockAddFlag).toHaveBeenCalledWith(
          'hs test-account create',
          'name',
          'BypassedDefaultsAccount'
        );
        expect(mockAddFlag).toHaveBeenCalledTimes(8);
      });
    });

    describe('interactive mode', () => {
      it('should ask for parameters when neither config nor name provided', async () => {
        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          description: 'Test account',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        const result = await tool.handler(input);

        // Should NOT run the command
        expect(mockRunCommandInDir).not.toHaveBeenCalled();

        // Should return a message asking for information
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: 'Ask the user for the account config JSON path or the name of the test account to create.',
            },
          ],
        });
      });
    });

    describe('error handling', () => {
      it('should handle command output with stderr warnings', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: 'Test account created successfully',
          stderr: 'Warning: Some non-critical warning message',
        });

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          configPath: './test-account.json',
          description: 'Test account',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        const result = await tool.handler(input);

        expect(result).toEqual({
          content: [
            { type: 'text', text: '/test/workspace' },
            { type: 'text', text: 'Test account created successfully' },
            {
              type: 'text',
              text: 'Warning: Some non-critical warning message',
            },
          ],
        });
      });

      it('should handle command execution errors', async () => {
        const error = new Error('Failed to create test account');
        mockRunCommandInDir.mockRejectedValue(error);

        const input: CreateTestAccountInputSchema = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          configPath: './test-account.json',
          description: 'Test account',
          marketingLevel: 'ENTERPRISE',
          opsLevel: 'ENTERPRISE',
          serviceLevel: 'ENTERPRISE',
          salesLevel: 'ENTERPRISE',
          contentLevel: 'ENTERPRISE',
          commerceLevel: 'ENTERPRISE',
        };

        const result = await tool.handler(input);

        expect(result).toEqual({
          content: [
            { type: 'text', text: '/test/workspace' },
            { type: 'text', text: 'Failed to create test account' },
          ],
        });
      });
    });
  });
});
