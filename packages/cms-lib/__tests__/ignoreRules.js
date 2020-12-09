const { shouldIgnoreFile } = require('../ignoreRules');

const CWD = '/Path/To/My/Repo';
const REPO_FOLDER = `${CWD}/repo-name-here`;
const NODE_MODULES_FOLDER = `${REPO_FOLDER}/node_modules`;
const NODE_MODULES_FILE = `${NODE_MODULES_FOLDER}/a-really-fake-package-name/README.md`;

describe('ignoreRules', () => {
  describe('shouldIgnoreFile', () => {
    it('ignores node_modules folder', () => {
      expect(shouldIgnoreFile(NODE_MODULES_FOLDER)).toBe(true);
    });

    it('ignores files nested within node_modules folder', () => {
      expect(shouldIgnoreFile(NODE_MODULES_FILE)).toBe(true);
    });

    it('ignores CLI config files', () => {
      expect(shouldIgnoreFile(`${CWD}/hubspot.config.yml`)).toBe(true);
      expect(shouldIgnoreFile(`${CWD}/hubspot.config.yaml`)).toBe(true);
      expect(shouldIgnoreFile(`${CWD}/some/dir/hubspot.config.yml`)).toBe(true);
      expect(shouldIgnoreFile(`${CWD}/some/dir/hubspot.config.yaml`)).toBe(
        true
      );
    });

    it('ignores hidden folders', () => {
      expect(shouldIgnoreFile(`${REPO_FOLDER}/.hiddenFolder`)).toBe(true);
    });

    it('ignores hidden files', () => {
      expect(shouldIgnoreFile(`${REPO_FOLDER}/.hiddenFile.js`)).toBe(true);
      expect(shouldIgnoreFile(`${REPO_FOLDER}/.*`)).toBe(true);
    });

    it('does not ignore allowed folders', () => {
      expect(shouldIgnoreFile(`${REPO_FOLDER}/hiddenFile/`)).toBe(false);
    });

    it('does not ignore allowed files', () => {
      expect(shouldIgnoreFile(`${REPO_FOLDER}/hiddenFile.js`)).toBe(false);
    });

    it('does not ignore the current folder', () => {
      expect(shouldIgnoreFile('.')).toBe(false);
    });
  });
});
