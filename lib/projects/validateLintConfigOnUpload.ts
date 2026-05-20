import path from 'path';
import type { ParsedPackageJson } from '@hubspot/project-parsing-lib/workspaces';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';
import {
  areAllLintPackagesInstalled,
  hasEslintConfig,
  isHubSpotEslintConfigActive,
} from './uieLinting.js';

type ValidateLintConfigOnUploadArgs = {
  srcDir: string;
  projectDir: string;
  parsedPackageJsons: ParsedPackageJson[];
  isLegacyPlatform: boolean;
};

export async function validateLintConfigOnUpload({
  srcDir,
  projectDir,
  parsedPackageJsons,
  isLegacyPlatform,
}: ValidateLintConfigOnUploadArgs): Promise<void> {
  const lintRoots = new Set<string>();
  if (isLegacyPlatform) {
    lintRoots.add(srcDir);
  } else {
    for (const { dir } of parsedPackageJsons) {
      lintRoots.add(dir);
    }
    if (lintRoots.size === 0) {
      lintRoots.add(srcDir);
    }
  }

  let hasAnyOutput = false;

  for (const lintRoot of lintRoots) {
    const relativeRoot = path.relative(projectDir, lintRoot) || '.';
    let warnMessage: string | undefined;

    if (!areAllLintPackagesInstalled(lintRoot)) {
      warnMessage =
        lib.projectUpload.handleProjectUpload.lintPackagesNotConfigured(
          relativeRoot
        );
    } else if (!hasEslintConfig(lintRoot)) {
      warnMessage =
        lib.projectUpload.handleProjectUpload.lintConfigNotFound(relativeRoot);
    } else if (!(await isHubSpotEslintConfigActive(lintRoot))) {
      warnMessage =
        lib.projectUpload.handleProjectUpload.lintHubSpotRulesNotActive(
          relativeRoot
        );
    }

    if (warnMessage) {
      if (!hasAnyOutput) {
        uiLogger.log('');
        hasAnyOutput = true;
      }
      uiLogger.warn(warnMessage);
    }
  }

  if (hasAnyOutput) {
    uiLogger.log('');
  }
}
