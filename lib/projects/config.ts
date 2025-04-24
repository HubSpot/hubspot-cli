import fs from 'fs-extra';
import path from 'path';
import findup from 'findup-sync';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAbsoluteFilePath, getCwd } from '@hubspot/local-dev-lib/path';

import { ProjectConfig } from '../../types/Projects';
import { PROJECT_CONFIG_FILE } from '../constants';
import { lib } from '../../lang/en';
import { uiCommandReference } from '../ui';
import { EXIT_CODES } from '../enums/exitCodes';

export function writeProjectConfig(
  configPath: string,
  config: ProjectConfig
): boolean {
  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.debug(e);
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
    logger.error('Could not read from project config');
    return { projectConfig: null, projectDir: null };
  }
}

export function validateProjectConfig(
  projectConfig: ProjectConfig | null,
  projectDir: string | null
): asserts projectConfig is ProjectConfig {
  if (!projectConfig || !projectDir) {
    logger.error(
      lib.projects.validateProjectConfig.configNotFound(
        uiCommandReference('hs project create')
      )
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!projectConfig.name || !projectConfig.srcDir) {
    logger.error(lib.projects.validateProjectConfig.configMissingFields);
    return process.exit(EXIT_CODES.ERROR);
  }

  const resolvedPath = path.resolve(projectDir, projectConfig.srcDir);
  if (!resolvedPath.startsWith(projectDir)) {
    const projectConfigFile = path.relative(
      '.',
      path.join(projectDir, PROJECT_CONFIG_FILE)
    );
    logger.error(
      lib.projects.validateProjectConfig.srcOutsideProjectDir(
        projectConfigFile,
        projectConfig.srcDir
      )
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!fs.existsSync(resolvedPath)) {
    logger.error(
      lib.projects.validateProjectConfig.srcDirNotFound(
        projectConfig.srcDir,
        projectDir
      )
    );

    return process.exit(EXIT_CODES.ERROR);
  }
}
