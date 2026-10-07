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
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import fs from 'fs';
import * as config from '@hubspot/local-dev-lib/config';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/command', async importOriginal => {
  const mod =
    await importOriginal<typeof import('../../../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});
vi.mock('../../../utils/feedbackTracking');
vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/config');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockReadFileSync = fs.readFileSync as MockedFunction<
  typeof fs.readFileSync
>;
const mockGetConfigAccountByName = vi.spyOn(config, 'getConfigAccountByName');

const validOutput = {
  accountName: 'MyTestAccount',
  accountId: 12345678,
  personalAccessKey: 'pak-test-key',
};

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
          outputSchema: expect.any(Object),
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
          stdout: JSON.stringify(validOutput),
          stderr: '',
        });

        const result = await tool.handler(baseInput);

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              'test-account',
              'create',
              '--config-path',
              './test-account.json',
              '--json',
              'true',
            ]),
          }),
          expect.any(Function)
        );

        expect(result).toEqual({
          content: [{ type: 'text', text: JSON.stringify(validOutput) }],
          structuredContent: validOutput,
        });
      });

      it('should handle absolute config path', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              'test-account',
              'create',
              '--config-path',
              '/absolute/path/to/config.json',
            ]),
          }),
          expect.any(Function)
        );
      });

      it('should prioritize config path over flags', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              '--config-path',
              './test-account.json',
            ]),
          }),
          expect.any(Function)
        );

        // Should not include --name flag since config path takes priority
        const callArgs = mockRunCommandInDir.mock.calls[0][1];
        expect(callArgs.args).not.toContain('--name');
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
          structuredContent: {},
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
          structuredContent: {},
        });
      });
    });

    describe('flag-based approach', () => {
      it('should create test account with name and all defaults', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              'test-account',
              'create',
              '--name',
              'MyTestAccount',
            ]),
          }),
          expect.any(Function)
        );
      });

      it('should add all flags with defaults when only name is provided', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
          stderr: '',
        });

        const input = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'MyTestAccount',
        } as CreateTestAccountInputSchema;

        await tool.handler(input);

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              'test-account',
              'create',
              '--name',
              'MyTestAccount',
              '--description',
              'MyTestAccount',
              '--marketing-level',
              'ENTERPRISE',
              '--ops-level',
              'ENTERPRISE',
              '--service-level',
              'ENTERPRISE',
              '--sales-level',
              'ENTERPRISE',
              '--content-level',
              'ENTERPRISE',
              '--commerce-level',
              'ENTERPRISE',
            ]),
          }),
          expect.any(Function)
        );
      });

      it('should create test account with account name and description', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              '--name',
              'MyTestAccount',
              '--description',
              'Test account for development',
            ]),
          }),
          expect.any(Function)
        );
      });

      it('should create test account with specific hub levels', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              '--name',
              'MixedTierAccount',
              '--marketing-level',
              'PROFESSIONAL',
              '--sales-level',
              'STARTER',
              '--content-level',
              'FREE',
            ]),
          }),
          expect.any(Function)
        );
      });

      it('should create test account with all hub levels specified', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              '--name',
              'AllHubsAccount',
              '--description',
              'Full configuration',
              '--marketing-level',
              'ENTERPRISE',
              '--ops-level',
              'PROFESSIONAL',
              '--service-level',
              'STARTER',
              '--sales-level',
              'ENTERPRISE',
              '--content-level',
              'PROFESSIONAL',
              '--commerce-level',
              'FREE',
            ]),
          }),
          expect.any(Function)
        );
      });
    });

    describe('handler defaults', () => {
      it('should use ENTERPRISE defaults for all hub levels when not specified', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              '--name',
              'DefaultLevelsAccount',
              '--marketing-level',
              'ENTERPRISE',
              '--ops-level',
              'ENTERPRISE',
              '--service-level',
              'ENTERPRISE',
              '--sales-level',
              'ENTERPRISE',
              '--content-level',
              'ENTERPRISE',
              '--commerce-level',
              'ENTERPRISE',
            ]),
          }),
          expect.any(Function)
        );
      });

      it('should use name as fallback for description when description is empty', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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

        // Implementation uses name as fallback for description
        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              '--description',
              'NoDescriptionAccount',
            ]),
          }),
          expect.any(Function)
        );
      });

      it('should add all hub level flags when defaults are applied', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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
        expect(result.structuredContent).toEqual(validOutput);
        expect(result.content[0]).toEqual({
          type: 'text',
          text: JSON.stringify(validOutput),
        });
      });

      it('should use ENTERPRISE defaults when values are undefined', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
          stderr: '',
        });

        const input = {
          absoluteCurrentWorkingDirectory: '/test/workspace',
          name: 'BypassedDefaultsAccount',
        } as CreateTestAccountInputSchema;

        await tool.handler(input);

        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/workspace',
          expect.objectContaining({
            executable: 'hs',
            args: expect.arrayContaining([
              '--name',
              'BypassedDefaultsAccount',
              '--marketing-level',
              'ENTERPRISE',
              '--ops-level',
              'ENTERPRISE',
              '--service-level',
              'ENTERPRISE',
              '--sales-level',
              'ENTERPRISE',
              '--content-level',
              'ENTERPRISE',
              '--commerce-level',
              'ENTERPRISE',
            ]),
          }),
          expect.any(Function)
        );
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
          structuredContent: {},
        });
      });
    });

    describe('JSON output', () => {
      const jsonInput: CreateTestAccountInputSchema = {
        absoluteCurrentWorkingDirectory: '/test/workspace',
        name: 'MyTestAccount',
        description: 'Test account',
        marketingLevel: 'ENTERPRISE',
        opsLevel: 'ENTERPRISE',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'ENTERPRISE',
        contentLevel: 'ENTERPRISE',
        commerceLevel: 'ENTERPRISE',
      };

      it('should request JSON output from the command', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
          stderr: '',
        });

        await tool.handler(jsonInput);

        const callArgs = mockRunCommandInDir.mock.calls[0][1];
        expect(callArgs.args).toContain('--json');
      });

      it('should return parsed JSON output as structuredContent', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput, null, 2),
          stderr: '',
        });

        const result = await tool.handler(jsonInput);

        expect(result.structuredContent).toEqual(validOutput);
        expect(result.isError).toBeUndefined();
      });

      it('should fall back to empty structuredContent when output is not valid schema JSON', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify({ accountId: 'not-a-number' }),
          stderr: '',
        });

        const result = await tool.handler(jsonInput);

        expect(result.structuredContent).toEqual({});
        expect(result.isError).toBeUndefined();
      });
    });

    describe('error handling', () => {
      it('should handle command output with stderr warnings', async () => {
        mockRunCommandInDir.mockResolvedValue({
          stdout: JSON.stringify(validOutput),
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
            { type: 'text', text: JSON.stringify(validOutput) },
            {
              type: 'text',
              text: 'Warning: Some non-critical warning message',
            },
          ],
          structuredContent: validOutput,
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

        await expect(tool.handler(input)).rejects.toThrow(
          'Failed to create test account'
        );
      });
    });
  });
});
