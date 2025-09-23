import { Arguments } from 'yargs';
import * as config from '@hubspot/local-dev-lib/config';
import * as gitUI from '../../ui/git.js';
import { checkAndWarnGitInclusionMiddleware } from '../gitMiddleware.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../ui/git');

const getConfigPathSpy = vi.spyOn(config, 'getConfigPath');
const checkAndWarnGitInclusionSpy = vi.spyOn(gitUI, 'checkAndWarnGitInclusion');

describe('lib/middleware/gitMiddleware', () => {
  describe('checkAndWarnGitInclusionMiddleware()', () => {
    it('should call checkAndWarnGitInclusion when command is provided and config path exists', () => {
      const mockConfigPath = '/path/to/config.js';
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
