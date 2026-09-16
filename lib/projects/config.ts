import fs from 'fs-extra';
import path from 'path';
import findup from 'findup-sync';
import { getAbsoluteFilePath, getCwd } from '@hubspot/local-dev-lib/path';
import {
  parseProjectConfig,
  ProjectConfigValidationError,
} from '@hubspot/project-parsing-lib/projects';
import type { ProjectConfig } from '@hubspot/project-parsing-lib/projects';

import { PROJECT_CONFIG_FILE } from '../constants.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

export { ProjectConfigValidationError } from '@hubspot/project-parsing-lib/projects';
export type { ProjectConfig } from '@hubspot/project-parsing-lib/projects';

export function writeProjectConfig(
  configPath: string,
  config: ProjectConfig
): boolean {
  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    uiLogger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    uiLogger.debug(e);
    return false;
  }
  return true;
}

export function getIsInProject(dir?: string): boolean {
  const configPath = getProjectConfigPath(dir);
  return !!configPath;
}

function getProjectConfigPath(dir?: string): string | null {
  const projectDir = dir ? getAbsoluteFilePath(dir) : getCwd();

  const configPath = findup(PROJECT_CONFIG_FILE, {
    cwd: projectDir,
    nocase: true,
  });

  return configPath;
}

export interface LoadedProjectConfig {
  projectDir: string;
  projectConfig: ProjectConfig;
}

export function getProjectConfig(dir?: string): LoadedProjectConfig {
  const configPath = getProjectConfigPath(dir);
  if (!configPath) {
    throw new ProjectConfigValidationError(
      lib.projects.validateProjectConfig.configNotFound
    );
  }

  const projectDir = path.dirname(configPath);
  const projectConfig = parseProjectConfig(projectDir);

  return { projectDir, projectConfig };
}
