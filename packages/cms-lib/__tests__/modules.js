const path = require('path');

const {
  isModuleFolder,
  isModuleFolderChild,
  validateSrcAndDestPaths,
  ValidationIds,
} = require('../modules');

const walk = require('../lib/walk');

const isLocal = true;
const isHubSpot = true;

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
      input = { isLocal, path: 'Card Section.module' };
      expect(isModuleFolder(input)).toBe(true);
      input = { isLocal, path: path.join('dir', 'Card Section.module') };
      expect(isModuleFolder(input)).toBe(true);
      // HubSpot
      input = { isHubSpot, path: 'Card Section.module' };
      expect(isModuleFolder(input)).toBe(true);
      input = { isHubSpot, path: 'dir/Card Section.module' };
      expect(isModuleFolder(input)).toBe(true);
    });
    it('should disregard trailing slashes', () => {
      let input;
      // Local
      input = { isLocal, path: path.join('Card Section.module', path.sep) };
      expect(isModuleFolder(input)).toBe(true);
      input = {
        isLocal,
        path: path.join('dir', 'Card Section.module', path.sep),
      };
      expect(isModuleFolder(input)).toBe(true);
      // HubSpot
      input = { isHubSpot, path: 'Card Section.module/' };
      expect(isModuleFolder(input)).toBe(true);
      input = { isHubSpot, path: 'dir/Card Section.module/' };
      expect(isModuleFolder(input)).toBe(true);
    });
    it('should return false for non-module folder paths', () => {
      let input;
      // Local
      input = { isLocal, path: '' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isLocal, path: path.sep };
      expect(isModuleFolder(input)).toBe(false);
      input = { isLocal, path: 'dir' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isLocal, path: path.join('Card Section.module', 'dir') };
      expect(isModuleFolder(input)).toBe(false);
      // HubSpot
      input = { isHubSpot, path: '' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isHubSpot, path: '/' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isHubSpot, path: 'dir' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isHubSpot, path: 'Card Section.module/dir' };
      expect(isModuleFolder(input)).toBe(false);
    });
    it('should return false for file paths', () => {
      let input;
      // Local
      input = { isLocal, path: 'fields.json' };
      expect(isModuleFolder(input)).toBe(false);
      input = {
        isLocal,
        path: path.join('Card Section.module', 'fields.json'),
      };
      expect(isModuleFolder(input)).toBe(false);
      // HubSpot
      input = { isHubSpot, path: 'fields.json' };
      expect(isModuleFolder(input)).toBe(false);
      input = { isHubSpot, path: 'Card Section.module/fields.json' };
      expect(isModuleFolder(input)).toBe(false);
    });
  });
  describe('isModuleFolderChild()', () => {
    it('should return true for child files/folders of module folders', () => {
      let input;
      // Local
      input = { isLocal, path: path.join('Card Section.module', 'dir') };
      expect(isModuleFolderChild(input)).toBe(true);
      input = {
        isLocal,
        path: path.join('Card Section.module', 'fields.json'),
      };
      expect(isModuleFolderChild(input)).toBe(true);
      input = {
        isLocal,
        path: path.join('dir', 'Card Section.module', 'dir', 'fields.json'),
      };
      expect(isModuleFolderChild(input)).toBe(true);
      // HubSpot
      input = { isHubSpot, path: 'Card Section.module/dir' };
      expect(isModuleFolderChild(input)).toBe(true);
      input = { isHubSpot, path: 'Card Section.module/fields.json' };
      expect(isModuleFolderChild(input)).toBe(true);
      input = { isHubSpot, path: 'dir/Card Section.module/dir/fields.json' };
      expect(isModuleFolderChild(input)).toBe(true);
    });
    it('should return false for module folders', () => {
      let input;
      // Local
      input = { isLocal, path: path.join('dir', 'Card Section.module') };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isLocal, path: 'Card Section.module' };
      expect(isModuleFolderChild(input)).toBe(false);
      // HubSpot
      input = { isHubSpot, path: 'dir/Card Section.module' };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isHubSpot, path: 'Card Section.module' };
      expect(isModuleFolderChild(input)).toBe(false);
    });
    it('should return false for folder/file paths not within a module folder', () => {
      let input;
      // Local
      input = { isLocal, path: path.join('dir', 'dir') };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isLocal, path: path.join('dir', 'fields.json') };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isLocal, path: 'dir' };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isLocal, path: 'fields.json' };
      expect(isModuleFolderChild(input)).toBe(false);
      // HubSpot
      input = { isHubSpot, path: 'dir/dir' };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isHubSpot, path: 'dir/fields.json' };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isHubSpot, path: 'dir' };
      expect(isModuleFolderChild(input)).toBe(false);
      input = { isHubSpot, path: 'fields.json' };
      expect(isModuleFolderChild(input)).toBe(false);
    });
  });
  describe('validateSrcAndDestPaths()', () => {
    const emptyLocal = { isLocal, path: '' };
    const emptyHubSpot = { isHubSpot, path: '' };
    const simpleTestCases = [
      {
        args: [],
        ids: [ValidationIds.SRC_REQUIRED, ValidationIds.DEST_REQUIRED],
      },
      {
        args: [emptyLocal],
        ids: [ValidationIds.DEST_REQUIRED],
      },
      {
        args: [null, emptyHubSpot],
        ids: [ValidationIds.SRC_REQUIRED],
      },
      {
        args: [emptyLocal, { isHubSpot }],
        ids: [ValidationIds.DEST_REQUIRED],
      },
      {
        args: [{ isLocal }, emptyHubSpot],
        ids: [ValidationIds.SRC_REQUIRED],
      },
      {
        args: [emptyLocal, emptyHubSpot],
        ids: [],
      },
      {
        args: [
          { isLocal, path: 'x' },
          { isHubSpot, path: 'x' },
        ],
        ids: [],
      },
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
    it('should normalize paths', async () => {
      let src = { isLocal, path: 'Car Section.module' };
      let dest = { isHubSpot, path: 'Car Section.module/js/../' };
      let result = await validateSrcAndDestPaths(src, dest);
      expect(result.length).toBe(0);
      src = { isLocal, path: path.join('Car Section.module', 'js', '..') };
      dest = { isHubSpot, path: 'Car Section.module' };
      result = await validateSrcAndDestPaths(src, dest);
      expect(result.length).toBe(0);
      src = { isLocal, path: 'Car Section.module' };
      dest = { isHubSpot, path: 'Car Section.module/js/main.js/../' };
      result = await validateSrcAndDestPaths(src, dest);
      expect(result.length).toBe(1);
      src = {
        isLocal,
        path: path.join('Car Section.module', 'js', 'main.js', '..', path.sep),
      };
      dest = { isHubSpot, path: 'Car Section.module' };
      result = await validateSrcAndDestPaths(src, dest);
      expect(result.length).toBe(0);
    });
    it('should walk local files if needed', async () => {
      const src = { isLocal, path: 'boilerplate' };
      const dest = { isHubSpot, path: 'Card Section.module/js' };
      const spy = jest.spyOn(walk, 'walk');
      await validateSrcAndDestPaths(src, dest);
      expect(spy).toHaveBeenCalled();
    });
    describe('hs upload', () => {
      describe('VALID: `src` is a module folder as is `dest`', () => {
        let src = { isLocal, path: 'Card Section.module' };
        let dest = { isHubSpot, path: 'Card Section.module' };
        it(`upload "${src.path}" "${dest.path}"`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(0);
        });
        src = {
          isLocal,
          path: path.join('boilerplate', 'modules', 'Card Section.module'),
        };
        dest = { isHubSpot, path: 'remote/Card Section.module/' };
        it(`upload "${src.path}" "${dest.path}"`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(0);
        });
      });
      describe('INVALID: `src` is a module folder but `dest` is not', () => {
        let src = { isLocal, path: 'Card Section.module' };
        let dest = { isHubSpot, path: 'Card Section' };
        it(`upload "${src.path}" "${dest.path}"`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_FOLDER_REQUIRED
          );
        });
        src = {
          isLocal,
          path: path.join('boilerplate', 'modules', 'Card Section.module'),
        };
        dest = { isHubSpot, path: 'fields.json' };
        it(`upload "${src.path}" "${dest.path}"`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_FOLDER_REQUIRED
          );
        });
        src = {
          isLocal,
          path: path.join('boilerplate', 'modules', 'Card Section.module'),
        };
        dest = { isHubSpot, path: 'remote/boilerplate/modules/' };
        it(`upload "${src.path}" "${dest.path}"`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_FOLDER_REQUIRED
          );
        });
      });
      describe('INVALID: `src` is a .module folder and `dest` is within a module. (Nesting)', () => {
        const src = { isLocal, path: 'Car Section.module' };
        const dest = { isHubSpot, path: 'Car Section.module/js' };
        it(`upload "${src.path}" "${dest.path}"`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_TO_MODULE_NESTING
          );
        });
      });
      describe('INVALID: `src` is a folder that includes modules and `dest` is within a module. (Nesting)', () => {
        const src = { isLocal, path: 'boilerplate' };
        const dest = { isHubSpot, path: 'Card Section.module/js' };
        it(`upload "${src.path}" "${dest.path}"`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(ValidationIds.MODULE_NESTING);
        });
      });
    });
  });
});
