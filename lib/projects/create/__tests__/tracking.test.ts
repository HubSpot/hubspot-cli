import {
  isFileSystemError,
  isGithubRateLimitError,
  isGithubError,
  getHttpStatusFromError,
} from '@hubspot/local-dev-lib/errors/index';
import { getProjectCreateFailureReason } from '../tracking.js';

vi.mock('@hubspot/local-dev-lib/errors/index');

const mockedIsGithubRateLimitError = vi.mocked(isGithubRateLimitError);
const mockedIsGithubError = vi.mocked(isGithubError);
const mockedGetHttpStatusFromError = vi.mocked(getHttpStatusFromError);
const mockedIsFileSystemError = vi.mocked(isFileSystemError);

describe('lib/projects/create/tracking', () => {
  describe('getProjectCreateFailureReason', () => {
    beforeEach(() => {
      mockedIsGithubRateLimitError.mockReturnValue(false);
      mockedIsGithubError.mockReturnValue(true);
      mockedGetHttpStatusFromError.mockReturnValue(undefined);
      mockedIsFileSystemError.mockReturnValue(false);
    });

    it('classifies a rate-limit error', () => {
      mockedIsGithubRateLimitError.mockReturnValue(true);

      expect(getProjectCreateFailureReason(new Error('Rate limited'))).toBe(
        'github-rate-limit'
      );
    });

    it('classifies a 404 GitHub error as github-not-found', () => {
      mockedGetHttpStatusFromError.mockReturnValue(404);

      expect(getProjectCreateFailureReason(new Error('Not found'))).toBe(
        'github-not-found'
      );
    });

    it('classifies other GitHub HTTP failures as github-error', () => {
      mockedGetHttpStatusFromError.mockReturnValue(500);

      expect(getProjectCreateFailureReason(new Error('Server error'))).toBe(
        'github-error'
      );
    });

    it('classifies a non-GitHub HTTP failure as http-error', () => {
      mockedGetHttpStatusFromError.mockReturnValue(500);
      mockedIsGithubError.mockReturnValue(false);

      expect(getProjectCreateFailureReason(new Error('Server error'))).toBe(
        'http-error'
      );
    });

    it('classifies a filesystem error', () => {
      mockedIsFileSystemError.mockReturnValue(true);

      expect(getProjectCreateFailureReason(new Error('EACCES'))).toBe(
        'filesystem'
      );
    });

    it('classifies an unrecognized error as unknown', () => {
      expect(getProjectCreateFailureReason(new Error('mystery'))).toBe(
        'unknown'
      );
    });
  });
});
