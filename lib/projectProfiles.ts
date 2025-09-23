import path from 'path';
import {
  loadHsProfileFile,
  getHsProfileFilename,
  getAllHsProfiles,
} from '@hubspot/project-parsing-lib';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types.js';
import { ProjectConfig } from '../types/Projects.js';
import { lib } from '../lang/en.js';
import { uiBetaTag, uiLine } from './ui/index.js';
import { uiLogger } from './ui/logger.js';
import { EXIT_CODES } from './enums/exitCodes.js';

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

export function loadProfile(
  projectConfig: ProjectConfig | null,
  projectDir: string | null,
  profileName: string
): HsProfileFile | undefined {
  if (!projectConfig || !projectDir) {
    uiLogger.error(lib.projectProfiles.loadProfile.errors.noProjectConfig);
    return;
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  const profileFilename = getHsProfileFilename(profileName);

  try {
    const profile = loadHsProfileFile(projectSourceDir, profileName);

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
export async function loadAndValidateProfile(
  projectConfig: ProjectConfig | null,
  projectDir: string | null,
  argsProfile: string | undefined
) {
  if (argsProfile) {
    logProfileHeader(argsProfile);

    const profile = loadProfile(projectConfig, projectDir, argsProfile);

    if (!profile) {
      uiLine();
      process.exit(EXIT_CODES.ERROR);
    }
    logProfileFooter(profile, true);
    return profile.accountId;
  } else {
    // A profile must be specified if this project has profiles configured
    await exitIfUsingProfiles(projectConfig, projectDir);
  }
  return undefined;
}
