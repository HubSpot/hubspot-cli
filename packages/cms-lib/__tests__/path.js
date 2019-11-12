const path = require('path');
const { splitHubSpotPath, splitLocalPath } = require('../path');

describe('cms-lib/path', () => {
  describe('splitHubSpotPath()', () => {
    const testSplit = (filepath, expectedParts, joined) => {
      test(filepath, () => {
        const parts = splitHubSpotPath(filepath);
        expect(parts).toEqual(expectedParts);
        expect(path.posix.join(...parts)).toBe(joined);
      });
    };
    testSplit('', [], '.');
    testSplit('a', ['a'], 'a');
    testSplit('a/b', ['a', 'b'], 'a/b');
    testSplit('a/b/', ['a', 'b'], 'a/b');
    testSplit('a/b///', ['a', 'b'], 'a/b');
    testSplit('/', ['/'], '/');
    testSplit('///', ['/'], '/');
    testSplit('/a', ['/', 'a'], '/a');
    testSplit('///a', ['/', 'a'], '/a');
    testSplit('/a/b', ['/', 'a', 'b'], '/a/b');
    testSplit('a.js', ['a.js'], 'a.js');
    testSplit('/a.js/', ['/', 'a.js'], '/a.js');
    testSplit('/x/a.js/', ['/', 'x', 'a.js'], '/x/a.js');
    testSplit('///x/////a.js///', ['/', 'x', 'a.js'], '/x/a.js');
    testSplit(
      '/project/My Module.module',
      ['/', 'project', 'My Module.module'],
      '/project/My Module.module'
    );
    testSplit(
      'project/My Module.module/js',
      ['project', 'My Module.module', 'js'],
      'project/My Module.module/js'
    );
    testSplit(
      'project/My Module.module/js/main.js/',
      ['project', 'My Module.module', 'js', 'main.js'],
      'project/My Module.module/js/main.js'
    );
    testSplit(
      'project/My Module.module/js/../css/',
      ['project', 'My Module.module', 'css'],
      'project/My Module.module/css'
    );
    testSplit(
      './project/My Module.module/js',
      ['project', 'My Module.module', 'js'],
      'project/My Module.module/js'
    );
    testSplit(
      '../project/My Module.module/js',
      ['..', 'project', 'My Module.module', 'js'],
      '../project/My Module.module/js'
    );
  });
  describe('splitLocalPath()', () => {
    const createTestSplit = pathImplementation => {
      return (filepath, expectedParts, joined) => {
        test(filepath, () => {
          const parts = splitLocalPath(filepath, pathImplementation);
          expect(parts).toEqual(expectedParts);
          expect(pathImplementation.join(...parts)).toBe(joined);
        });
      };
    };
    const getLocalFileSystemTestCases = pathImplementation => {
      const { sep } = pathImplementation;
      const isWin32 = sep === path.win32.sep;
      const splitRoot = isWin32 ? 'C:' : '/';
      const pathRoot = isWin32 ? 'C:\\' : '/';
      return [
        [
          `${pathRoot}My Module.module`,
          [splitRoot, 'My Module.module'],
          `${pathRoot}My Module.module`,
        ],
        [
          `${pathRoot}My Module.module${sep}`,
          [splitRoot, 'My Module.module'],
          `${pathRoot}My Module.module`,
        ],
        [`My Module.module${sep}`, ['My Module.module'], 'My Module.module'],
        [
          `${pathRoot}My Module.module${sep}js${sep}main.js`,
          [splitRoot, 'My Module.module', 'js', 'main.js'],
          `${pathRoot}My Module.module${sep}js${sep}main.js`,
        ],
        [
          `${pathRoot}My Module.module${sep}${sep}${sep}js${sep}main.js${sep}${sep}`,
          [splitRoot, 'My Module.module', 'js', 'main.js'],
          `${pathRoot}My Module.module${sep}js${sep}main.js`,
        ],
        [
          `${pathRoot}My Module.module${sep}js${sep}..${sep}css`,
          [splitRoot, 'My Module.module', 'css'],
          `${pathRoot}My Module.module${sep}css`,
        ],
        [
          `My Module.module${sep}js${sep}..${sep}css`,
          ['My Module.module', 'css'],
          `My Module.module${sep}css`,
        ],
      ];
    };
    ['posix', 'win32'].forEach(platform => {
      describe(platform, () => {
        const pathImplementation = path[platform];
        const testSplit = createTestSplit(pathImplementation);
        const testCases = getLocalFileSystemTestCases(pathImplementation);
        if (!(testCases && testCases.length)) {
          throw new Error(`Missing ${platform} splitLocalPath() test cases`);
        }
        testCases.forEach(testCase => testSplit(...testCase));
      });
    });
  });
});
