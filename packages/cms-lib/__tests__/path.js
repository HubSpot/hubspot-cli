const path = require('path');
const { splitHubSpotPath } = require('../path');

describe('cms-lib/path', () => {
  describe('splitHubSpotPath()', () => {
    const testSplit = (filepath, expectedParts, joined) => {
      test(filepath, () => {
        const parts = splitHubSpotPath(filepath);
        expect(parts).toEqual(expectedParts);
        expect(path.posix.join(...parts)).toBe(joined);
      });
    };
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
      'project/My Module.module',
      ['project', 'My Module.module'],
      'project/My Module.module'
    );
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
  });
});
