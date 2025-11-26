import fs from 'fs-extra';
import path from 'path';
import findup from 'findup-sync';
import { getAbsoluteFilePath, getCwd } from '@hubspot/local-dev-lib/path';

import { ProjectConfig } from '../../types/Projects.js';
import { PROJECT_CONFIG_FILE } from '../constants.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';
import ProjectValidationError from '../errors/ProjectValidationError.js';

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
  projectDir: string | null;
  projectConfig: ProjectConfig | null;
}

export async function getProjectConfig(
  dir?: string
): Promise<LoadedProjectConfig> {
  const configPath = getProjectConfigPath(dir);
  if (!configPath) {
    return { projectConfig: null, projectDir: null };
  }

  try {
    const config = fs.readFileSync(configPath);
    const projectConfig: ProjectConfig = JSON.parse(config.toString());
    return {
      projectDir: path.dirname(configPath),
      projectConfig,
    };
  } catch (e) {
    uiLogger.error(lib.projects.getProjectConfig.error);
    return { projectConfig: null, projectDir: null };
  }
}

export function validateProjectConfig(
  projectConfig: ProjectConfig | null,
  projectDir: string | null
): asserts projectConfig is ProjectConfig {
  if (!projectConfig || !projectDir) {
    throw new ProjectValidationError(
      lib.projects.validateProjectConfig.configNotFound
    );
  }

  if (!projectConfig.name || !projectConfig.srcDir) {
    throw new ProjectValidationError(
      lib.projects.validateProjectConfig.configMissingFields
    );
  }

  const resolvedPath = path.resolve(projectDir, projectConfig.srcDir);
  if (!resolvedPath.startsWith(projectDir)) {
    const projectConfigFile = path.relative(
      '.',
      path.join(projectDir, PROJECT_CONFIG_FILE)
    );
    throw new ProjectValidationError(
      lib.projects.validateProjectConfig.srcOutsideProjectDir(
        projectConfigFile,
        projectConfig.srcDir
      )
    );
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new ProjectValidationError(
      lib.projects.validateProjectConfig.srcDirNotFound(
        projectConfig.srcDir,
        projectDir
      )
    );
  }
}
