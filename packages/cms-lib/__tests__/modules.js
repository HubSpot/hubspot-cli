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

const filePaths = [...folderPaths, ...moduleFolderPaths].reduce(
  (acc, folder) => acc.concat(path.join(folder, 'file.js')),
  []
);

jest.mock('../lib/walk', () => ({
  // Given a filepath folder of 'boilerplate/'
  walk: jest
    .fn()
    .mockReturnValue(
      Promise.resolve([
        'boilerplate/modules/bar.module/fields.json',
        'boilerplate/modules/bar.module/meta.json',
        'boilerplate/modules/bar.module/module.css',
        'boilerplate/modules/bar.module/module.html',
        'boilerplate/modules/bar.module/module.js',
      ])
    ),
}));

describe('cms-lib/modules', () => {
  describe('isModuleFolder()', () => {
    it('should return true for module folder paths', () => {
      moduleFolderPaths.forEach(filepath => {
        expect(isModuleFolder(filepath)).toBe(true);
      });
    });
    it('should return false for non-module folder paths', () => {
      folderPaths.forEach(filepath => {
        expect(isModuleFolder(filepath)).toBe(false);
      });
    });
    it('should return false for file paths', () => {
      filePaths.forEach(filepath => {
        expect(isModuleFolder(filepath)).toBe(false);
      });
    });
  });
  describe('isModuleFolderChild()', () => {
    const moduleFolderChildren = moduleFolderPaths.reduce((acc, folder) => {
      return acc.concat(
        path.join(folder, 'a'),
        path.join(folder, 'a/b'),
        path.join(folder, 'file.js'),
        path.join(folder, 'a/file.js'),
        path.join(folder, 'a/b/file.js')
      );
    }, []);
    it('should return true for child files/folders of module folders', () => {
      moduleFolderChildren.forEach(filepath => {
        expect(isModuleFolderChild(filepath)).toBe(true);
      });
    });
    it('should return false for module folders', () => {
      moduleFolderPaths.forEach(filepath => {
        expect(isModuleFolderChild(filepath)).toBe(false);
      });
    });
    it('should return false for folder paths not within a module folder', () => {
      folderPaths.forEach(filepath => {
        expect(isModuleFolderChild(filepath)).toBe(false);
      });
    });
    it('should return false for file paths not within a module folder', () => {
      folderPaths
        .map(folder => path.join(folder, 'file.js'))
        .forEach(filepath => {
          expect(isModuleFolderChild(filepath)).toBe(false);
        });
    });
  });
  describe('validateSrcAndDestPaths()', () => {
    const emptyArgs = [
      {
        args: [],
        ids: [ValidationIds.SRC_REQUIRED, ValidationIds.DEST_REQUIRED],
      },
      { args: [''], ids: [ValidationIds.DEST_REQUIRED] },
      { args: [null, ''], ids: [ValidationIds.SRC_REQUIRED] },
      { args: ['', ''], ids: [] },
      { args: ['x', 'x'], ids: [] },
    ];
    it('should be an async function', () => {
      expect(validateSrcAndDestPaths() instanceof Promise).toBe(true);
    });
    it('should return an array', () => {
      emptyArgs.forEach(async ({ args }) => {
        const result = await validateSrcAndDestPaths(...args);
        expect(Array.isArray(result)).toBe(true);
      });
    });
    it('should require `src` and `dest` string params', async () => {
      emptyArgs.forEach(async ({ args, ids }) => {
        const result = await validateSrcAndDestPaths(...args);
        expect(result.length).toBe(ids.length);
        ids.forEach((id, idx) => {
          expect(result[idx] && result[idx].id).toEqual(id);
        });
      });
    });
    describe('Guard input conditions', () => {
      describe('`src` is a module folder as is `dest`', () => {
        const src = 'foo.module';
        const dest = 'modules/foo.module';
        it(`upload ${src} ${dest}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(0);
        });
      });
      describe('`src` is a module folder but `dest` is not', () => {
        const src = 'foo.module';
        const dest = 'bar';
        it(`upload ${src} ${dest}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_FOLDER_REQUIRED
          );
        });
      });
      describe('`src` is a .module folder and dest is within a module. (Nesting)', () => {
        const src = 'foo.module';
        const dest = 'bar.module/zzz';
        it(`upload ${src}, ${dest}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(
            ValidationIds.MODULE_TO_MODULE_NESTING
          );
        });
      });
      describe('src is a folder that includes modules and dest is within a module. (Nesting)', () => {
        const src = 'boilerplate';
        const dest = 'bar.module/zzz';
        it(`upload ${src} ${dest}`, async () => {
          const result = await validateSrcAndDestPaths(src, dest);
          expect(result.length).toBe(1);
          expect(result[0] && result[0].id).toBe(ValidationIds.MODULE_NESTING);
        });
      });
    });
  });
});
