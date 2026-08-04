import chalk from 'chalk';
import {
  fetchProjectBuilds,
  getBuildStatus,
} from '@hubspot/local-dev-lib/api/projects';
import { BUILD_STATUS } from '@hubspot/local-dev-lib/enums/build';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { meetsMinimumPlatformVersion } from '@hubspot/project-parsing-lib/projects';
import { PLATFORM_VERSIONS } from '@hubspot/project-parsing-lib/constants';
import { getLastSuccessfulBuild } from './builds.js';
import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import { listPrompt } from '../prompts/promptUtils.js';
import { commands } from '../../lang/en.js';
import { createRelease, type Release } from '../../api/releases.js';

function buildChoiceName(build: Build): string {
  const base = build.uploadMessage
    ? `${build.buildId} — ${build.uploadMessage}`
    : `${build.buildId} — ${commands.project.release.create.noUploadMessage}`;
  return build.status !== BUILD_STATUS.SUCCESS
    ? `[${chalk.yellow('DISABLED')}] ${base}`
    : base;
}

export async function resolveBuildId(
  accountId: number,
  projectName: string,
  buildOption?: number,
  force?: boolean
): Promise<number | null | undefined> {
  if (buildOption) {
    return buildOption;
  }

  if (force) {
    const lastSuccessful = await getLastSuccessfulBuild(accountId, projectName);
    return lastSuccessful ? lastSuccessful.buildId : null;
  }

  let results;
  try {
    ({
      data: { results },
    } = await fetchProjectBuilds(accountId, projectName));
  } catch (e) {
    if (
      isSpecifiedError(e, { statusCode: 404 }) ||
      isSpecifiedError(e, { statusCode: 400 })
    ) {
      return undefined;
    }
    throw e;
  }

  if (results.length === 0) {
    return undefined;
  }

  const lastSuccessful = await getLastSuccessfulBuild(accountId, projectName);

  if (!lastSuccessful) {
    uiLogger.error(
      commands.project.release.create.errors.noSuccessfulBuilds(projectName)
    );
    return null;
  }

  return listPrompt<number>(commands.project.release.create.buildIdPrompt, {
    choices: results.map(b => ({
      name: buildChoiceName(b),
      value: b.buildId,
      disabled:
        b.status !== BUILD_STATUS.SUCCESS
          ? `– ${commands.project.release.create.buildStatus[b.status] ?? b.status}`
          : undefined,
    })),
  });
}

export async function validateBuildForRelease(
  accountId: number,
  projectName: string,
  buildId: number
): Promise<boolean> {
  try {
    const { data: build } = await getBuildStatus(
      accountId,
      projectName,
      buildId
    );
    return meetsMinimumPlatformVersion(
      build.platformVersion,
      PLATFORM_VERSIONS.v2026_09_BETA
    );
  } catch (e) {
    if (isSpecifiedError(e, { statusCode: 404 })) {
      uiLogger.error(
        commands.project.release.create.errors.buildNotFound(
          buildId,
          projectName
        )
      );
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId,
          request: 'project release create',
        })
      );
    }
    throw e;
  }
}

export async function executeRelease(
  accountId: number,
  projectName: string,
  buildId: number
): Promise<Release> {
  try {
    const { data: release } = await createRelease(
      accountId,
      projectName,
      buildId
    );
    return release;
  } catch (e) {
    logError(
      e,
      new ApiErrorContext({
        accountId,
        request: 'project release create',
      })
    );
    throw e;
  }
}
