import path from 'path';
import {
  loadHsProfileFile,
  getHsProfileFilename,
} from '@hubspot/project-parsing-lib';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ProjectConfig } from '../types/Projects';
import { lib } from '../lang/en';

export async function loadProfile(
  projectConfig: ProjectConfig | null,
  projectDir: string | null,
  profileName: string
): Promise<HsProfileFile | undefined> {
  if (!projectConfig || !projectDir) {
    logger.error(lib.projectProfiles.loadProfile.errors.noProjectConfig);
    return;
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  const profileFilename = getHsProfileFilename(profileName);

  try {
    const profile = await loadHsProfileFile(projectSourceDir, profileName);

    if (!profile) {
      logger.error(
        lib.projectProfiles.loadProfile.errors.profileNotFound(profileFilename)
      );
      return;
    }

    if (!profile.accountId) {
      logger.error(
        lib.projectProfiles.loadProfile.errors.missingAccountId(profileFilename)
      );
      return;
    }

    return profile;
  } catch (e) {
    logger.error(
      lib.projectProfiles.loadProfile.errors.failedToLoadProfile(
        profileFilename
      )
    );
    return;
  }
}
