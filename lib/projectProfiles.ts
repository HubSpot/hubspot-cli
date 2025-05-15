import path from 'path';
import {
  loadHsProfileFile,
  getHsProfileFilename,
  getAllHsProfiles,
} from '@hubspot/project-parsing-lib';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import { ProjectConfig } from '../types/Projects';
import { lib } from '../lang/en';
import { uiBetaTag, uiLine } from './ui';
import { uiLogger } from './ui/logger';
import { EXIT_CODES } from './enums/exitCodes';

export function logProfileHeader(profileName: string): void {
  uiLine();
  uiBetaTag(
    lib.projectProfiles.logs.usingProfile(getHsProfileFilename(profileName))
  );
  uiLogger.log('');
}

export function logProfileFooter(
  profile: HsProfileFile,
  includeVariables: boolean = false
): void {
  uiLogger.log(
    lib.projectProfiles.logs.profileTargetAccount(profile.accountId)
  );
  if (includeVariables) {
    uiLogger.log('');
    uiLogger.log(lib.projectProfiles.logs.profileVariables);
    Object.entries(profile.variables ?? {}).forEach(([key, value]) => {
      uiLogger.log(`  ${key}: ${value}`);
    });
  }
  uiLine();
  uiLogger.log('');
}

export async function loadProfile(
  projectConfig: ProjectConfig | null,
  projectDir: string | null,
  profileName: string
): Promise<HsProfileFile | undefined> {
  if (!projectConfig || !projectDir) {
    uiLogger.error(lib.projectProfiles.loadProfile.errors.noProjectConfig);
    return;
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  const profileFilename = getHsProfileFilename(profileName);

  try {
    const profile = await loadHsProfileFile(projectSourceDir, profileName);

    if (!profile) {
      uiLogger.error(
        lib.projectProfiles.loadProfile.errors.profileNotFound(profileFilename)
      );
      return;
    }

    if (!profile.accountId) {
      uiLogger.error(
        lib.projectProfiles.loadProfile.errors.missingAccountId(profileFilename)
      );
      return;
    }

    return profile;
  } catch (e) {
    uiLogger.error(
      lib.projectProfiles.loadProfile.errors.failedToLoadProfile(
        profileFilename
      )
    );
    return;
  }
}

export async function exitIfUsingProfiles(
  projectConfig: ProjectConfig | null,
  projectDir: string | null
): Promise<void> {
  if (projectConfig && projectDir) {
    const existingProfiles = await getAllHsProfiles(
      path.join(projectDir, projectConfig.srcDir)
    );

    if (existingProfiles.length > 0) {
      uiLogger.error(
        lib.projectProfiles.exitIfUsingProfiles.errors.noProfileSpecified
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }
}
