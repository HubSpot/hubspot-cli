import path from 'path';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import { listPrompt } from './promptUtils.js';
import { loadProfile } from '../projects/projectProfiles.js';
import { lib } from '../../lang/en.js';
import { PromptChoices } from '../../types/Prompts.js';
import { ProjectConfig } from '../../types/Projects.js';

function generateProfilePromptOption(
  projectDir: string,
  projectConfig: ProjectConfig,
  profileName: string
): PromptChoices[number] {
  const choice: PromptChoices[number] = {
    name: profileName,
    value: profileName,
  };

  try {
    const profile = loadProfile(projectConfig, projectDir, profileName);
    choice.name = `${profileName} [${profile.accountId}]`;
  } catch (e) {
    choice.name = `${profileName} [Invalid profile]`;
    choice.disabled = true;
  }

  return choice;
}

export async function projectProfilePrompt(
  projectDir: string,
  projectConfig: ProjectConfig,
  profileName?: string,
  exitIfMissing?: boolean
): Promise<string | null> {
  if (profileName) {
    return profileName;
  }

  const existingProfiles = await getAllHsProfiles(
    path.join(projectDir, projectConfig.srcDir)
  );

  if (existingProfiles.length !== 0) {
    if (existingProfiles.length === 1) {
      return existingProfiles[0];
    }

    // In automated workflows exit instead of prompting
    if (exitIfMissing) {
      throw new Error(lib.prompts.projectProfilePrompt.exitMessage);
    }

    const listOptions = existingProfiles.map(p =>
      generateProfilePromptOption(projectDir, projectConfig, p)
    );

    const hasAnyValidProfiles = listOptions.some(
      option =>
        typeof option === 'object' && 'name' in option && !option.disabled
    );

    // Exit early if the user has no valid profiles for us to show in the prompt
    if (!hasAnyValidProfiles) {
      throw new Error(lib.prompts.projectProfilePrompt.noValidProfilesMessage);
    }

    const profileNameFromPrompt = await listPrompt<string>(
      lib.prompts.projectProfilePrompt.message,
      {
        choices: listOptions,
      }
    );
    return profileNameFromPrompt;
  }

  return null;
}
