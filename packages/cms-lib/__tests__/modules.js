const path = require('path');

const {
  isModuleFolder,
  isModuleFolderChild,
  validateSrcAndDestPaths,
  ValidationIds,
} = require('../modules');

const folderPaths = ['', '/', 'foo', '/foo'];

const moduleFolderPaths = folderPaths.reduce((acc, folder) => {
  return acc.concat(
    path.join(folder, 'widget.module'),
    path.join(folder, 'my widget.module')
  );
}, []);

const isLocal = true;
const isHubSpot = true;
const emptyLocal = { isLocal, path: '' };
const emptyHubSpot = { isHubSpot, path: '' };

// Seems you can't use nested manual mocks.
// ca. 2016 https://github.com/facebook/jest/issues/335#issuecomment-250400941
jest.mock('../lib/walk', () => require('../lib/__mocks__/walk'));

describe('cms-lib/modules', () => {
  describe('isModuleFolder()', () => {
    it('should throw on invalid input', () => {
      expect(() => isModuleFolder('foo')).toThrow();
      expect(() => isModuleFolder({ path: 'foo' })).toThrow();
      expect(() => isModuleFolder({ isLocal })).toThrow();
      expect(() => isModuleFolder({ isHubSpot })).toThrow();
      expect(() => isModuleFolder({ isHubSpot, path: 'foo' })).not.toThrow();
      expect(() => isModuleFolder({ isLocal, path: 'foo' })).not.toThrow();
    });
    it('should return true for module folder paths', () => {
      let input;
      // Local
      input = { isLocal, path: 'My Module.module' };
      expect(isModuleFolder(input)).toBe(true);
      input = { isLocal, path: path.join('dir', 'My Module.module') };
      expect(isModuleFolder(input)).toBe(true);
      // HubSpot
      input = { isHubSpot, path: 'My Module.module' };
      expect(isModuleFolder(input)).toBe(true);
      input = { isHubSpot, path: 'dir/My Module.module' };
      expect(isModuleFolder(input)).toBe(true);
    });
    it('should disregard trailing slashes', () => {
      let input;
      // Local
      input = { isLocal, path: path.join('My Module.module', path.sep) };
      expect(isModuleFolder(input)).toBe(true);
      input = { isLocal, path: path.join('dir', 'My Module.module', path.sep) };
      expect(isModuleFolder(input)).toBe(true);
      // HubSpot
      input = { isHubSpot, path: 'My Module.module/' };
      expect(isModuleFolder(input)).toBe(true);
      input = { isHubSpot, path: 'dir/My Module.module/' };
      expect(isModuleFolder(input)).toBe(true);
    });
    it('should return false for non-module folder paths', () => {
      let input;
      // Local
      input = { isLocal, path: 'dir' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isLocal, path: path.join('My Module.module', 'dir') };
      expect(isModuleFolder(input)).toBe(false);
      // HubSpot
      input = { isHubSpot, path: 'dir' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isHubSpot, path: 'My Module.module/dir' };
      expect(isModuleFolder(input)).toBe(false);
    });
    it('should return false for file paths', () => {
      let input;
      // Local
      input = { isLocal, path: 'fields.json' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isLocal, path: path.join('My Module.module', 'fields.json') };
      expect(isModuleFolder(input)).toBe(false);
      // HubSpot
      input = { isHubSpot, path: 'fields.json' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isHubSpot, path: 'My Module.module/fields.json' };
      expect(isModuleFolder(input)).toBe(false);
    });
  });
  describe('isModuleFolderChild()', () => {
    const createInputs = paths => {
      return paths.map(p => ({ isHubSpot, path: p }));
    };
    const moduleFolderChildrenInputs = moduleFolderPaths.reduce(
      (acc, folder) => {
        return acc.concat(
          { isHubSpot, path: path.join(folder, 'a') },
          { isHubSpot, path: path.join(folder, 'a/b') },
          { isHubSpot, path: path.join(folder, 'file.js') },
          { isHubSpot, path: path.join(folder, 'a/file.js') },
          { isHubSpot, path: path.join(folder, 'a/b/file.js') }
        );
      },
      []
    );
    it('should return true for child files/folders of module folders', () => {
      moduleFolderChildrenInputs.forEach(input => {
        expect(isModuleFolderChild(input)).toBe(true);
      });
    });
    it('should return false for module folders', () => {
      createInputs(moduleFolderPaths).forEach(filepath => {
        expect(isModuleFolderChild(filepath)).toBe(false);
      });
    });
    it('should return false for folder paths not within a module folder', () => {
      createInputs(folderPaths).forEach(filepath => {
        expect(isModuleFolderChild(filepath)).toBe(false);
      });
    });
    it('should return false for file paths not within a module folder', () => {
      createInputs(
        folderPaths.map(folder => path.join(folder, 'file.js'))
      ).forEach(filepath => {
        expect(isModuleFolderChild(filepath)).toBe(false);
      });
    });
  });
  describe('validateSrcAndDestPaths()', () => {
    const simpleTestCases = [
      {
        args: [],
        ids: [ValidationIds.SRC_REQUIRED, ValidationIds.DEST_REQUIRED],
      },
      { args: [emptyLocal], ids: [ValidationIds.DEST_REQUIRED] },
      { args: [null, emptyHubSpot], ids: [ValidationIds.SRC_REQUIRED] },
      { args: [emptyLocal, { isHubSpot }], ids: [ValidationIds.DEST_REQUIRED] },
      { args: [{ isLocal }, emptyHubSpot], ids: [ValidationIds.SRC_REQUIRED] },
      { args: [emptyLocal, emptyHubSpot], ids: [] },
      { args: [{ isLocal, path: 'x' }, { isHubSpot, path: 'x' }], ids: [] },
    ];
    it('should be an async function', () => {
      expect(validateSrcAndDestPaths() instanceof Promise).toBe(true);
    });
    it('should return an array', () => {
      simpleTestCases.forEach(async ({ args }) => {
        const result = await validateSrcAndDestPaths(...args);
        expect(Array.isArray(result)).toBe(true);
      });
    });
    it('should require `src` and `dest` string params', async () => {
      simpleTestCases.forEach(async ({ args, ids }) => {
        const result = await validateSrcAndDestPaths(...args);
        expect(result.length).toBe(ids.length);
        ids.forEach((id, idx) => {
          expect(result[idx] && result[idx].id).toEqual(id);
        });
      });
    });
    describe('Guard input conditions', () => {
      describe('`src` is a module folder as is `dest`', () => {
        const src = { isLocal, path: 'foo.module' };
        const dest = { isHubSpot, path: 'modules/foo.module' };
        it(`upload ${src.path} ${dest.path}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(0);
        });
      });
      describe('`src` is a module folder but `dest` is not', () => {
        const src = { isLocal, path: 'foo.module' };
        const dest = { isHubSpot, path: 'bar' };
        it(`upload ${src.path} ${dest.path}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_FOLDER_REQUIRED
          );
        });
      });
      describe('`src` is a .module folder and dest is within a module. (Nesting)', () => {
        const src = { isLocal, path: 'foo.module' };
        const dest = { isHubSpot, path: 'bar.module/zzz' };
        it(`upload ${src.path} ${dest.path}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_TO_MODULE_NESTING
          );
        });
      });
      describe('src is a folder that includes modules and dest is within a module. (Nesting)', () => {
        const src = { isLocal, path: 'boilerplate' };
        const dest = { isHubSpot, path: 'bar.module/zzz' };
        it(`upload ${src.path} ${dest.path}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(ValidationIds.MODULE_NESTING);
        });
      });
    });
  });
});
