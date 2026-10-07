import path from 'path';
import stripAnsi from 'strip-ansi';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import { ProjectConfig } from '../../types/Projects.js';
import { uiLogger } from '../ui/logger.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { logError, getErrorMessage } from '../errorHandlers/index.js';
import { commands } from '../../lang/en.js';
import {
  ProfileValidationJsonOutput,
  ValidationIssueJsonOutput,
} from '../jsonOutput/projectValidate.js';
import {
  getProfileAccountId,
  validateProjectForProfile,
} from './projectProfiles.js';
import { handleTranslate, validateSourceDirectory } from './upload.js';

export type ProjectValidationResult = {
  valid: boolean;
  errors: ValidationIssueJsonOutput[];
  warnings: ValidationIssueJsonOutput[];
  profiles: ProfileValidationJsonOutput[];
};

type ValidateProjectArgs = {
  projectConfig: ProjectConfig;
  projectDir: string;
  derivedAccountId: number;
  profile?: string;
  formatOutputAsJson?: boolean;
};

export function toIssue(
  error: unknown,
  profile?: string
): ValidationIssueJsonOutput {
  const issue: ValidationIssueJsonOutput = {
    message: stripAnsi(getErrorMessage(error)).trim(),
  };
  if (profile) {
    issue.profile = profile;
  }
  return issue;
}

function logValidationErrors(validationErrors: (string | Error)[]): void {
  uiLogger.log('');
  validationErrors.forEach(error => {
    if (error instanceof Error) {
      logError(error);
    } else {
      uiLogger.log(error);
    }
  });
}

type ValidateProfileArgs = {
  projectConfig: ProjectConfig;
  projectDir: string;
  derivedAccountId: number;
  profileName: string;
  formatOutputAsJson?: boolean;
  indentSpinners: boolean;
};

type ProfileValidation = {
  profile: ProfileValidationJsonOutput;
  errors: ValidationIssueJsonOutput[];
  rawErrors: (string | Error)[];
};

async function validateProfile({
  projectConfig,
  projectDir,
  derivedAccountId,
  profileName,
  formatOutputAsJson,
  indentSpinners,
}: ValidateProfileArgs): Promise<ProfileValidation> {
  const rawErrors = await validateProjectForProfile({
    projectConfig,
    projectDir,
    profileName,
    derivedAccountId,
    ...(indentSpinners ? { indentSpinners: true } : {}),
  });

  const accountId = formatOutputAsJson
    ? getProfileAccountId(projectConfig, projectDir, profileName)
    : undefined;
  const profile: ProfileValidationJsonOutput = {
    name: profileName,
    valid: rawErrors.length === 0,
  };
  if (accountId !== undefined) {
    profile.accountId = accountId;
  }

  return {
    profile,
    errors: rawErrors.map(e => toIssue(e, profileName)),
    rawErrors,
  };
}

export async function validateProject({
  projectConfig,
  projectDir,
  derivedAccountId,
  profile,
  formatOutputAsJson,
}: ValidateProjectArgs): Promise<ProjectValidationResult> {
  const errors: ValidationIssueJsonOutput[] = [];
  const warnings: ValidationIssueJsonOutput[] = [];
  const profiles: ProfileValidationJsonOutput[] = [];
  let valid = true;

  const srcDir = path.resolve(projectDir, projectConfig.srcDir);
  const projectProfiles = await getAllHsProfiles(
    path.join(projectDir, projectConfig.srcDir)
  );

  if (profile) {
    const result = await validateProfile({
      projectConfig,
      projectDir,
      derivedAccountId,
      profileName: profile,
      formatOutputAsJson,
      indentSpinners: false,
    });
    profiles.push(result.profile);
    if (result.rawErrors.length) {
      valid = false;
      errors.push(...result.errors);
      logValidationErrors(result.rawErrors);
    }
  } else if (projectProfiles.length > 0) {
    SpinniesManager.add('validatingAllProfiles', {
      text: commands.project.validate.spinners.validatingAllProfiles,
    });

    const rawErrors: (string | Error)[] = [];
    for (const profileName of projectProfiles) {
      const result = await validateProfile({
        projectConfig,
        projectDir,
        derivedAccountId,
        profileName,
        formatOutputAsJson,
        indentSpinners: true,
      });
      profiles.push(result.profile);
      if (result.rawErrors.length) {
        valid = false;
        errors.push(...result.errors);
      }
      rawErrors.push(...result.rawErrors);
    }

    if (valid) {
      SpinniesManager.succeed('validatingAllProfiles', {
        text: commands.project.validate.spinners.allProfilesValidationSucceeded,
      });
    } else {
      SpinniesManager.fail('validatingAllProfiles', {
        text: commands.project.validate.spinners.allProfilesValidationFailed,
      });
    }
    logValidationErrors(rawErrors);
  } else {
    try {
      await handleTranslate({
        projectDir,
        projectConfig,
        accountId: derivedAccountId,
        skipValidation: false,
      });
    } catch (e) {
      valid = false;
      errors.push(toIssue(e));
      uiLogger.error(commands.project.validate.failure(projectConfig.name));
      logError(e);
      uiLogger.log('');
    }
  }

  if (valid) {
    try {
      const sourceWarnings = await validateSourceDirectory(
        srcDir,
        projectConfig,
        projectDir
      );
      warnings.push(
        ...sourceWarnings.map(warning => ({
          message: stripAnsi(warning.message).trim(),
          file: warning.file,
        }))
      );
    } catch (e) {
      valid = false;
      errors.push(toIssue(e));
      logError(e);
    }
  }

  return { valid, errors, warnings, profiles };
}
