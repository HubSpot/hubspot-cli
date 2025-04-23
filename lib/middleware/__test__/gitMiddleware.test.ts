import { Arguments } from 'yargs';
import * as config from '@hubspot/local-dev-lib/config';
import * as gitUI from '../../ui/git';
import { checkAndWarnGitInclusionMiddleware } from '../gitMiddleware';

jest.mock('@hubspot/local-dev-lib/config');
jest.mock('../../ui/git');

const getConfigPathSpy = jest.spyOn(config, 'getConfigPath');
const checkAndWarnGitInclusionSpy = jest.spyOn(
  gitUI,
  'checkAndWarnGitInclusion'
);

describe('lib/middleware/gitMiddleware', () => {
  describe('checkAndWarnGitInclusionMiddleware()', () => {
    it('should call checkAndWarnGitInclusion when command is provided and config path exists', () => {
      const mockConfigPath = '/path/to/config';
      getConfigPathSpy.mockReturnValue(mockConfigPath);

      const argv: Arguments = {
        _: ['some-command'],
        $0: 'hs',
      };

      checkAndWarnGitInclusionMiddleware(argv);

      expect(getConfigPathSpy).toHaveBeenCalledTimes(1);
      expect(checkAndWarnGitInclusionSpy).toHaveBeenCalledWith(mockConfigPath);
    });

    it('should not call checkAndWarnGitInclusion when no command is provided', () => {
      const argv: Arguments = {
        _: [],
        $0: 'hs',
      };

      checkAndWarnGitInclusionMiddleware(argv);

      expect(getConfigPathSpy).not.toHaveBeenCalled();
      expect(checkAndWarnGitInclusionSpy).not.toHaveBeenCalled();
    });

    it('should not call checkAndWarnGitInclusion when config path is null', () => {
      getConfigPathSpy.mockReturnValue(null);

      const argv: Arguments = {
        _: ['some-command'],
        $0: 'hs',
      };

      checkAndWarnGitInclusionMiddleware(argv);

      expect(getConfigPathSpy).toHaveBeenCalledTimes(1);
      expect(checkAndWarnGitInclusionSpy).not.toHaveBeenCalled();
    });
  });
});
