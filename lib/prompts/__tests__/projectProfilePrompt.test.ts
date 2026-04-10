import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as profileParsing from '@hubspot/project-parsing-lib/profiles';
import { projectProfilePrompt } from '../projectProfilePrompt.js';
import * as promptUtils from '../promptUtils.js';
import * as projectProfiles from '../../projects/projectProfiles.js';
import { lib } from '../../../lang/en.js';

vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../promptUtils');
vi.mock('../../projects/projectProfiles');

const mockedGetAllHsProfiles = vi.mocked(profileParsing.getAllHsProfiles);
const mockedListPrompt = vi.mocked(promptUtils.listPrompt);
const mockedLoadProfile = vi.mocked(projectProfiles.loadProfile);

describe('projectProfilePrompt', () => {
  const mockProjectDir = '/test/project';
  const mockProjectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: '1.0.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedLoadProfile.mockReturnValue({
      accountId: 123456,
      variables: {},
    });
  });

  it('should return profileName when provided', async () => {
    const result = await projectProfilePrompt(
      mockProjectDir,
      mockProjectConfig,
      'test-profile'
    );

    expect(result).toBe('test-profile');
    expect(mockedGetAllHsProfiles).not.toHaveBeenCalled();
  });

  it('should return null when no profiles exist', async () => {
    mockedGetAllHsProfiles.mockResolvedValue([]);

    const result = await projectProfilePrompt(
      mockProjectDir,
      mockProjectConfig
    );

    expect(result).toBeNull();
    expect(mockedListPrompt).not.toHaveBeenCalled();
  });

  it('should return single profile without prompting', async () => {
    mockedGetAllHsProfiles.mockResolvedValue(['only-profile']);

    const result = await projectProfilePrompt(
      mockProjectDir,
      mockProjectConfig
    );

    expect(result).toBe('only-profile');
    expect(mockedListPrompt).not.toHaveBeenCalled();
  });

  it('should return single profile without prompting when exitIfMissing is true', async () => {
    mockedGetAllHsProfiles.mockResolvedValue(['only-profile']);

    const result = await projectProfilePrompt(
      mockProjectDir,
      mockProjectConfig,
      undefined,
      true
    );

    expect(result).toBe('only-profile');
    expect(mockedListPrompt).not.toHaveBeenCalled();
  });

  it('should prompt when multiple profiles exist', async () => {
    mockedGetAllHsProfiles.mockResolvedValue(['profile1', 'profile2']);
    mockedListPrompt.mockResolvedValue('profile2');

    const result = await projectProfilePrompt(
      mockProjectDir,
      mockProjectConfig
    );

    expect(result).toBe('profile2');
    expect(mockedListPrompt).toHaveBeenCalledWith(expect.any(String), {
      choices: [
        { name: 'profile1 [123456]', value: 'profile1' },
        { name: 'profile2 [123456]', value: 'profile2' },
      ],
    });
  });

  it('should throw error if multiple profiles exist and no profile specified and exitIfMissing is true', async () => {
    mockedGetAllHsProfiles.mockResolvedValue(['profile1', 'profile2']);

    await expect(
      projectProfilePrompt(mockProjectDir, mockProjectConfig, undefined, true)
    ).rejects.toThrow(lib.prompts.projectProfilePrompt.exitMessage);
  });

  it('should not throw if profile is explicitly provided and exitIfMissing is true', async () => {
    const result = await projectProfilePrompt(
      mockProjectDir,
      mockProjectConfig,
      'explicit-profile',
      true
    );

    expect(result).toBe('explicit-profile');
    expect(mockedGetAllHsProfiles).not.toHaveBeenCalled();
  });

  it('should not throw error when multiple profiles exist when exitIfMissing is false', async () => {
    mockedGetAllHsProfiles.mockResolvedValue(['profile1', 'profile2']);
    mockedListPrompt.mockResolvedValue('profile1');

    const result = await projectProfilePrompt(
      mockProjectDir,
      mockProjectConfig,
      undefined,
      false
    );

    expect(result).toBe('profile1');
    expect(mockedListPrompt).toHaveBeenCalledWith(expect.any(String), {
      choices: [
        { name: 'profile1 [123456]', value: 'profile1' },
        { name: 'profile2 [123456]', value: 'profile2' },
      ],
    });
  });
});
