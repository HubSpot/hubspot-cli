const path = require('path');
const {
  isPathToFile,
  isPathToModule,
  isPathToRoot,
  recurseFolder,
  fetchFolderFromApi,
  getTypeDataFromPath,
} = require('../fileMapper');
const apiFileMapper = require('../api/fileMapper');
const folderWithoutSources = require('./fixtures/fileMapper/folderWithoutSources');

jest.mock('../api/fileMapper');

const rootPaths = ['', '/', '\\'];
const filePaths = ['a/b/c.js', '/a/b/c.js', 'x.html', '/x.html'];
const modulePaths = ['a/b/c.module', '/a/b/c.module', 'x.module', '/x.module'];
const folderPaths = ['a/b/c', '/a/b/c', 'a/b/c/', '/a/b/c/', 'x'];
const invalidPaths = [null, undefined, '.', './'];

function testPathDeterminationFunction(name, pathType, fn, truthy, falsey) {
  describe(`${name}()`, () => {
    it('should be a function', () => {
      expect(typeof fn).toBe('function');
    });
    it('should return false for invalid paths', () => {
      invalidPaths.forEach(filepath => {
        expect(fn(filepath)).toBe(false);
      });
    });
    it(`should return true for a ${pathType} path, false otherwise`, () => {
      truthy.forEach(filepath => {
        expect(fn(filepath)).toBe(true);
      });
      falsey.forEach(filepath => {
        expect(fn(filepath)).toBe(false);
      });
    });
    it('should handle extra whitespace', () => {
      const TAB = '\t';
      const addWhitespace = x => ` ${TAB}${x} ${TAB} `;
      truthy.map(addWhitespace).forEach(filepath => {
        expect(fn(filepath)).toBe(true);
      });
      falsey.map(addWhitespace).forEach(filepath => {
        expect(fn(filepath)).toBe(false);
      });
    });
  });
}

describe('cli-lib/fileMapper', () => {
  testPathDeterminationFunction(
    'isPathToFile',
    'file',
    isPathToFile,
    [...filePaths],
    [...folderPaths, ...modulePaths, ...rootPaths]
  );
  testPathDeterminationFunction(
    'isPathToModule',
    'module',
    isPathToModule,
    [...modulePaths],
    [...filePaths, ...folderPaths, ...rootPaths]
  );
  testPathDeterminationFunction(
    'isPathToRoot',
    'root',
    isPathToRoot,
    [...rootPaths],
    [...filePaths, ...folderPaths, ...modulePaths]
  );

  describe('recurseFolder()', () => {
    const totalNodesInTree = 11;
    const rootNodePath = '/cms-theme-boilerplate/templates';

    const testRelativePaths = (rootNodeName, passRootNode) => {
      recurseFolder(
        folderWithoutSources,
        (node, { filepath, depth }) => {
          const isRootFolderNode = node.folder && depth === 0;
          if (isRootFolderNode) {
            expect(filepath).toBe(rootNodeName);
          } else {
            const relativePath = node.path.slice(rootNodePath.length);
            expect(filepath).toBe(path.join(rootNodeName, relativePath));
          }
        },
        passRootNode ? rootNodeName : undefined
      );
    };

    it('should be a function', () => {
      expect(typeof recurseFolder).toBe('function');
    });
    it('should recurse over each node in the tree', () => {
      let count = 0;
      recurseFolder(folderWithoutSources, node => {
        expect(node === Object(node)).toBe(true);
        ++count;
      });
      expect(count).toBe(totalNodesInTree);
    });
    it('should pass the current folder depth to the callback', () => {
      const isUInt = x => x === x >>> 0;
      const depthCounts = {
        0: 0,
        1: 0,
        2: 0,
      };
      recurseFolder(folderWithoutSources, (node, { depth }) => {
        expect(isUInt(depth)).toBe(true);
        depthCounts[depth] += 1;
      });
      expect(depthCounts[0]).toBe(1);
      expect(depthCounts[1]).toBe(7);
      expect(depthCounts[2]).toBe(3);
    });
    it('should pass the relative filepath to the callback', () => {
      testRelativePaths('templates', false);
    });
    it('should pass the relative filepath with a specified root to the callback', () => {
      testRelativePaths('foo', true);
    });
    it('should exit recursion when `false` is returned by the callback', () => {
      const exitAt = 5;
      let count = 0;
      recurseFolder(folderWithoutSources, () => {
        ++count;
        if (count === exitAt) return false;
        return undefined;
      });
      expect(count).toBe(exitAt);
    });
  });

  describe('getTypeDataFromPath()', () => {
    it('should return file flags per the request input', () => {
      filePaths.forEach(async p => {
        const {
          isFile,
          isModule,
          isFolder,
          isRoot,
        } = await getTypeDataFromPath(p);
        expect(isFile).toBe(true);
        expect(isModule).toBe(false);
        expect(isFolder).toBe(false);
        expect(isRoot).toBe(false);
      });
    });
    it('should return folder flags per the request input', () => {
      folderPaths.forEach(async p => {
        const {
          isFile,
          isModule,
          isFolder,
          isRoot,
        } = await getTypeDataFromPath(p);
        expect(isFile).toBe(false);
        expect(isModule).toBe(false);
        expect(isFolder).toBe(true);
        expect(isRoot).toBe(false);
      });
    });
    it('should return root folder flags per the request input', () => {
      rootPaths.forEach(async p => {
        const {
          isFile,
          isModule,
          isFolder,
          isRoot,
        } = await getTypeDataFromPath(p);
        expect(isFile).toBe(false);
        expect(isModule).toBe(false);
        expect(isFolder).toBe(true);
        expect(isRoot).toBe(true);
      });
    });
    it('should return module folder flags per the request input', () => {
      modulePaths.forEach(async p => {
        const {
          isFile,
          isModule,
          isFolder,
          isRoot,
        } = await getTypeDataFromPath(p);
        expect(isFile).toBe(false);
        expect(isModule).toBe(true);
        expect(isFolder).toBe(true);
        expect(isRoot).toBe(false);
      });
    });
  });

  describe('fetchFolderFromApi()', () => {
    const accountId = 67890;

    describe('fetch folder', () => {
      const input = {
        accountId,
        src: '1234',
      };
      it('should execute the download client per the request input', async () => {
        const spy = jest.spyOn(apiFileMapper, 'download');
        await fetchFolderFromApi(input);
        expect(spy).toHaveBeenCalled();
      });
      it('should return the folder FileMapperNode per the request input', async () => {
        const node = await fetchFolderFromApi(input);
        expect(node).toMatchObject({
          path: `/${input.src}`,
          name: path.basename(input.src),
          folder: true,
          children: expect.arrayContaining([
            expect.objectContaining({ name: 'test.html' }),
          ]),
        });
      });
    });

    describe('fetch module (.module)', () => {
      const input = {
        accountId,
        src: 'cms-theme-boilerplate/modules/Card section.module',
      };
      it('should execute the download client per the request input', async () => {
        const spy = jest.spyOn(apiFileMapper, 'download');
        await fetchFolderFromApi(input);
        expect(spy).toHaveBeenCalled();
      });
      it('should return the module FileMapperNode per the request input', async () => {
        const node = await fetchFolderFromApi(input);
        expect(node).toMatchObject({
          path: `/${input.src}`,
          name: path.basename(input.src),
          folder: true,
          children: expect.arrayContaining([
            expect.objectContaining({ name: '_locales' }),
            expect.objectContaining({ name: 'fields.json' }),
            expect.objectContaining({ name: 'meta.json' }),
            expect.objectContaining({ name: 'module.css' }),
            expect.objectContaining({ name: 'module.html' }),
            expect.objectContaining({ name: 'module.js' }),
          ]),
        });
      });
    });

    describe('fetch all (/)', () => {
      const input = {
        accountId,
        src: '/',
      };
      it('should execute the download client per the request input', async () => {
        const spy = jest.spyOn(apiFileMapper, 'download');
        await fetchFolderFromApi(input);
        expect(spy).toHaveBeenCalled();
      });
      it('should return the root folder FileMapperNode per the request input', async () => {
        const node = await fetchFolderFromApi(input);
        expect(node).toMatchObject({
          path: '/',
          name: '',
          folder: true,
          children: expect.arrayContaining([
            expect.objectContaining({ path: '/1234' }),
          ]),
        });
      });
    });
  });
});
