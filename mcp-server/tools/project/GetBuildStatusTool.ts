import { TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { formatTextContents } from '../../utils/content.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  fetchProjectBuilds,
  getBuildStatus,
} from '@hubspot/local-dev-lib/api/projects';
import type { Build, SubbuildStatus } from '@hubspot/local-dev-lib/types/Build';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import moment from 'moment';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
} from './constants.js';
import { getConfigDefaultAccountIfExists } from '@hubspot/local-dev-lib/config';
import { setupHubSpotConfig } from '../../utils/config.js';

const TOOL_NAME = 'get-build-status';

interface BuildWithErrors extends Build {
  buildErrorMessage?: string;
}

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
  buildId: z
    .number()
    .optional()
    .describe(
      'Optional: Specific build ID to inspect. If omitted, shows recent builds to help identify the latest build.'
    ),
  limit: z
    .number()
    .optional()
    .default(3)
    .describe(
      'Number of recent builds to fetch when buildId is not specified.'
    ),
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type GetBuildStatusInputSchema = z.infer<typeof inputSchemaZodObject>;

function getStatusIcon(status: string): string {
  return status === 'SUCCESS' ? '✓' : '⚠️';
}

function formatDuration(startedAt: string, finishedAt: string): string {
  const duration = moment.duration(moment(finishedAt).diff(moment(startedAt)));
  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();
  const seconds = duration.seconds();

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

function formatSubbuilds(subbuilds: SubbuildStatus[], indent = '  '): string[] {
  const lines: string[] = [];

  subbuilds.forEach(sub => {
    const icon = getStatusIcon(sub.status);
    lines.push(
      `${indent}${icon} ${sub.buildName} (${sub.buildType}): ${sub.status}`
    );
    if (sub.errorMessage) {
      lines.push(`${indent}  Error: ${sub.errorMessage}`);
    }
  });

  return lines;
}

function formatBuildList(builds: BuildWithErrors[]): string {
  const lines: string[] = [];

  builds.forEach((build, index) => {
    const icon = getStatusIcon(build.status);
    const timeAgo = moment(build.finishedAt).fromNow();
    const duration = formatDuration(build.startedAt, build.finishedAt);

    lines.push(`Build #${build.buildId} - ${build.status} ${icon}`);
    lines.push(`  Finished: ${timeAgo} (Duration: ${duration})`);

    if (build.uploadMessage) {
      lines.push(`  Message: ${build.uploadMessage}`);
    }

    if (build.status === 'FAILURE' && build.buildErrorMessage) {
      lines.push(`  Error: ${build.buildErrorMessage}`);
    }

    if (build.subbuildStatuses.length > 0) {
      lines.push(`  Subbuilds:`);
      lines.push(...formatSubbuilds(build.subbuildStatuses, '    '));
    }

    if (index < builds.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}

function formatBuildDetails(build: BuildWithErrors): string {
  const lines: string[] = [];
  const icon = getStatusIcon(build.status);

  lines.push(`Build #${build.buildId} Details\n`);
  lines.push(`Status: ${build.status} ${icon}`);
  lines.push(`Platform Version: ${build.platformVersion}`);
  lines.push(
    `Started: ${moment(build.startedAt).format('YYYY-MM-DD HH:mm:ss UTC')}`
  );
  lines.push(
    `Finished: ${moment(build.finishedAt).format('YYYY-MM-DD HH:mm:ss UTC')}`
  );
  lines.push(`Duration: ${formatDuration(build.startedAt, build.finishedAt)}`);

  if (build.uploadMessage) {
    lines.push(`\nUpload Message:\n${build.uploadMessage}`);
  }

  if (build.buildErrorMessage) {
    lines.push(`\nBuild Error:\n${build.buildErrorMessage}`);
  }

  if (build.subbuildStatuses.length > 0) {
    lines.push(`\nSubbuilds:`);
    lines.push(...formatSubbuilds(build.subbuildStatuses));
  } else {
    lines.push(`\nSubbuilds: None`);
  }

  return lines.join('\n');
}

export class GetBuildStatusTool extends Tool<GetBuildStatusInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    absoluteProjectPath,
    absoluteCurrentWorkingDirectory,
    buildId,
    limit,
  }: GetBuildStatusInputSchema): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);
    await trackToolUsage(TOOL_NAME);

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

      let output: string;

      if (buildId) {
        const response = await getBuildStatus(accountId, projectName, buildId);
        const build = response.data as BuildWithErrors;
        output = formatBuildDetails(build);
      } else {
        const response = await fetchProjectBuilds(accountId, projectName, {
          limit,
        });
        const { results } = response.data;

        if (!results || results.length === 0) {
          return formatTextContents(
            absoluteCurrentWorkingDirectory,
            `No builds found for project '${projectName}'.`
          );
        }

        output = `Recent builds for '${projectName}':\n\n${formatBuildList(results)}`;
      }

      return formatTextContents(absoluteCurrentWorkingDirectory, output);
    } catch (error) {
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
        title: 'Get HubSpot Projects Build Status and Errors',
        description:
          'Retrieves build status and error messages for HubSpot projects. When buildId is omitted, shows recent builds with their status(default 3) - use this to find the latest builds when troubleshooting. When buildId is provided, shows detailed error information for that specific build. Displays buildErrorMessage and subbuild failures to help diagnose build issues.',
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      this.handler
    );
  }
}
