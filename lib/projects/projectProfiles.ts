import path from 'path';
import {
  loadHsProfileFile,
  getHsProfileFilename,
  getAllHsProfiles,
  validateProfileVariables,
  type HsProfileFile,
} from '@hubspot/project-parsing-lib/profiles';
import { ProjectConfig } from '../../types/Projects.js';
import { commands, lib } from '../../lang/en.js';
import { indent, uiBetaTag, uiLine } from '../ui/index.js';
import { uiLogger } from '../ui/logger.js';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import SpinniesManager from '../ui/SpinniesManager.js';
import { handleTranslate } from './upload.js';
import { getErrorMessage } from '../errorHandlers/index.js';

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
): HsProfileFile | never {
  if (!projectConfig || !projectDir) {
    throw new Error(lib.projectProfiles.loadProfile.errors.noProjectConfig);
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  const profileFilename = getHsProfileFilename(profileName);

  let profile;
  try {
    profile = loadHsProfileFile(projectSourceDir, profileName);
  } catch (e) {
    throw new Error(
      lib.projectProfiles.loadProfile.errors.failedToLoadProfile(
        profileFilename
      )
    );
  }

  if (!profile) {
    throw new Error(
      lib.projectProfiles.loadProfile.errors.profileNotFound(profileFilename)
    );
  }

  if (!profile.accountId) {
    throw new Error(
      lib.projectProfiles.loadProfile.errors.missingAccountId(profileFilename)
    );
  }

  try {
    getConfigAccountById(profile.accountId);
  } catch (error) {
    throw new Error(
      lib.projectProfiles.loadProfile.errors.listedAccountNotFound(
        profile.accountId,
        profileFilename
      )
    );
  }

  return profile;
}

export async function enforceProfileUsage(
  projectConfig: ProjectConfig | null,
  projectDir: string | null
): Promise<void> {
  if (projectConfig && projectDir) {
    const existingProfiles = await getAllHsProfiles(
      path.join(projectDir, projectConfig.srcDir)
    );

    if (existingProfiles.length > 0) {
      throw new Error(
        lib.projectProfiles.exitIfUsingProfiles.errors.noProfileSpecified
      );
    }
  }
}

export async function loadAndValidateProfile(
  projectConfig: ProjectConfig | null,
  projectDir: string | null,
  profileName: string | undefined,
  silent = false
): Promise<number | undefined> {
  if (!profileName) {
    await enforceProfileUsage(projectConfig, projectDir);
    return;
  }

  if (!silent) {
    logProfileHeader(profileName);
  }
  const profile = loadProfile(projectConfig, projectDir, profileName);

  if (!silent) {
    logProfileFooter(profile, true);
  }

  if (profile.variables) {
    const validationResult = validateProfileVariables(
      profile.variables,
      profileName
    );
    if (!validationResult.success) {
      throw new Error(
        lib.projectProfiles.loadProfile.errors.profileNotValid(
          profileName,
          validationResult.errors
        )
      );
    }
  }

  return profile.accountId;
}

function formatProfileValidationError(
  error: unknown,
  leadingIndentationLevel: number = 0
): string {
  // Trim leading whitespace and replace tabs with spaces to reducing indentations
  const errorMessage = getErrorMessage(error)
    .trimStart()
    .replaceAll('\t', indent(2));

  return `${indent(leadingIndentationLevel)}${errorMessage}\n`;
}

type ValidateProjectForProfileOptions = {
  projectConfig: ProjectConfig;
  projectDir: string;
  profileName: string;
  derivedAccountId: number;
  indentSpinners?: boolean;
  silent?: boolean;
};

export async function validateProjectForProfile({
  projectConfig,
  projectDir,
  profileName,
  derivedAccountId,
  indentSpinners = false,
  silent = false,
}: ValidateProjectForProfileOptions): Promise<(string | Error)[]> {
  let targetAccountId = derivedAccountId;
  const spinnerName = `validatingProfile-${profileName}`;
  const profileFilename = getHsProfileFilename(profileName);

  if (!silent) {
    SpinniesManager.add(spinnerName, {
      text: commands.project.validate.spinners.validatingProfile(
        profileFilename
      ),
      indent: indentSpinners ? indent(1).length : 0,
    });
  }

  try {
    const accountId = await loadAndValidateProfile(
      projectConfig,
      projectDir,
      profileName,
      true
    );

    targetAccountId = accountId || derivedAccountId;
  } catch (error) {
    SpinniesManager.fail(spinnerName, {
      text: commands.project.validate.spinners.profileValidationFailed(
        profileName
      ),
      failColor: 'white',
    });
    return [formatProfileValidationError(error)];
  }

  try {
    await handleTranslate({
      projectDir: projectDir!,
      projectConfig,
      accountId: targetAccountId,
      skipValidation: false,
      profile: profileName,
      includeTranslationErrorMessage: false,
    });
  } catch (error) {
    if (!silent) {
      SpinniesManager.fail(spinnerName, {
        text: commands.project.validate.spinners.invalidWithProfile(
          profileName
        ),
        failColor: 'white',
      });
    }
    const errors: (string | Error)[] = [
      commands.project.validate.failureWithProfile(profileName),
    ];
    errors.push(formatProfileValidationError(error, 1));
    return errors;
  }

  if (!silent) {
    SpinniesManager.succeed(spinnerName, {
      text: commands.project.validate.spinners.profileValidationSucceeded(
        profileFilename
      ),
      succeedColor: 'white',
    });
  }
  return [];
}
