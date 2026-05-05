import { TextContentResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { formatTextContents } from '../../utils/content.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { http } from '@hubspot/local-dev-lib/http';
import { ProjectLog } from '@hubspot/local-dev-lib/types/ProjectLog';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
} from './constants.js';
import { getConfigDefaultAccountIfExists } from '@hubspot/local-dev-lib/config';
import { setupHubSpotConfig } from '../../utils/config.js';

const TOOL_NAME = 'get-build-logs';
const PROJECTS_LOGS_API_PATH = 'dfs/logging/v1';

interface BuildLogsSubstep {
  pipelineStepId: number;
  pipelineSubstepId: string;
  pipelineStage: string;
  projectName: string;
  logs: ProjectLog[];
}

interface BuildLogsResponse {
  pipelineStage: string;
  pipelineStepId: number;
  projectName: string;
  logs: BuildLogsSubstep[];
}

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
  buildId: z
    .number()
    .describe(
      'Build ID to fetch logs for. Use get-build-status to find recent build IDs.'
    ),
  logLevel: z
    .enum(['ERROR', 'WARN', 'INFO', 'ALL'])
    .describe(
      'Filter logs by level. ERROR: Show only errors, WARN: Show only warnings, INFO: Show only info, ALL: Show all logs. Defaults to ALL if not specified.'
    )
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type GetBuildLogsInputSchema = z.infer<typeof inputSchemaZodObject>;

function flattenLogs(response: BuildLogsResponse): ProjectLog[] {
  const allLogs: ProjectLog[] = [];

  response.logs.forEach(substep => {
    substep.logs.forEach(log => {
      allLogs.push(log);
    });
  });

  return allLogs.sort((a, b) => a.timestamp - b.timestamp);
}

function filterLogsByLevel(
  logs: ProjectLog[],
  logLevel: 'ERROR' | 'WARN' | 'INFO' | 'ALL'
): ProjectLog[] {
  if (logLevel === 'ALL') {
    return logs;
  }
  return logs.filter(log => log.logLevel === logLevel);
}

function formatLogs(logs: ProjectLog[]): string {
  if (logs.length === 0) {
    return 'No logs found.';
  }

  return logs
    .map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short',
      });

      const component = log.pipelineSubstepName || `Step ${log.pipelineStepId}`;

      return `[${log.logLevel}][${component}] ${timestamp} ${log.message}`;
    })
    .join('\n');
}

export class GetBuildLogsTool extends Tool<GetBuildLogsInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, TOOL_NAME);
  }

  async handler({
    absoluteProjectPath,
    absoluteCurrentWorkingDirectory,
    buildId,
    logLevel,
  }: GetBuildLogsInputSchema): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    try {
      const accountId = getConfigDefaultAccountIfExists()?.accountId;
      if (!accountId) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          'No account ID found. Please run `hs account auth` to configure an account, or set a default account with `hs account use <account>`'
        );
      }

      const { projectConfig, projectDir } =
        await getProjectConfig(absoluteProjectPath);
      validateProjectConfig(projectConfig, projectDir);
      const projectName = projectConfig.name;

      const response = await http.get<BuildLogsResponse>(accountId, {
        url: `${PROJECTS_LOGS_API_PATH}/logs/projects/${encodeURIComponent(projectName)}/builds/${buildId}`,
      });

      const buildLogsResponse = response.data;

      if (!buildLogsResponse.logs || buildLogsResponse.logs.length === 0) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          `No logs found for build #${buildId} in project '${projectName}'.`
        );
      }

      const allLogs = flattenLogs(buildLogsResponse);

      if (allLogs.length === 0) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          `No logs found for build #${buildId} in project '${projectName}'.`
        );
      }

      const resolvedLogLevel = logLevel || 'ALL';
      const filteredLogs = filterLogsByLevel(allLogs, resolvedLogLevel);

      let output: string;
      if (filteredLogs.length === 0) {
        output = `No ${resolvedLogLevel} level logs found for build #${buildId} in '${projectName}'.\nShowing all logs instead:\n\n${formatLogs(allLogs)}`;
      } else {
        output = `Logs for build #${buildId} in '${projectName}' (${resolvedLogLevel} level):\n\n${formatLogs(filteredLogs)}`;
      }

      return formatTextContents(absoluteCurrentWorkingDirectory, output);
    } catch (error) {
      this.logger.debug(TOOL_NAME, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
      let errorMessage: string;
      if (isHubSpotHttpError(error)) {
        errorMessage = error.toString();
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      return formatTextContents(absoluteCurrentWorkingDirectory, errorMessage);
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      TOOL_NAME,
      {
        title: 'Get HubSpot Project Build Logs',
        description:
          'Retrieves build logs for a specific HubSpot project build. Use this to debug build failures by viewing the full build pipeline output. This tool is for more comprehensive troubleshootings or addressing build WARNINGs, build errors should be troubleshooted with get-build-status tool first. Logs can be filtered by level (ERROR, WARN, INFO, or ALL). Use `hs project list-builds`  first to identify the build ID and error messages. If you do not know the project path, use the find-projects tool first to locate HubSpot projects in the workspace.',
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      input => this.wrappedHandler(input)
    );
  }
}
