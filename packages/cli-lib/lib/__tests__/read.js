const fs = require('fs');
const {
  flattenAndRemoveSymlinks,
  getFileInfoAsync,
  STAT_TYPES,
} = require('../read');

jest.mock('fs');

const buildLstatMock = opts => (filepath, callback) => {
  const stats = {
    isSymbolicLink: () => !!opts.isSymbolicLink,
    isDirectory: () => !!opts.isDirectory,
    isFile: () => !!opts.isFile,
  };
  callback(null, stats);
};

describe('read', () => {
  describe('getFileInfoAsync()', () => {
    it('returns filepath and type for files', async () => {
      fs.lstat.mockImplementation(buildLstatMock({ isFile: true }));
      const fileData = await getFileInfoAsync('modules', 'module.html');

      expect(fileData.filepath).toBe('modules/module.html');
      expect(fileData.type).toBe(STAT_TYPES.FILE);
    });

    it('returns filepath and type for directories', async () => {
      fs.lstat.mockImplementation(buildLstatMock({ isDirectory: true }));
      const fileData = await getFileInfoAsync('modules', 'module.html');

      expect(fileData.filepath).toBe('modules/module.html');
      expect(fileData.type).toBe(STAT_TYPES.DIRECTORY);
    });

    it('returns filepath and type for symbolic links', async () => {
      fs.lstat.mockImplementation(buildLstatMock({ isSymbolicLink: true }));
      const fileData = await getFileInfoAsync('modules', 'module.html');

      expect(fileData.filepath).toBe('modules/module.html');
      expect(fileData.type).toBe(STAT_TYPES.SYMBOLIC_LINK);
    });
  });

  describe('flattenAndRemoveSymlinks()', () => {
    it('flattens file data into an array', () => {
      const filesData = [
        { type: STAT_TYPES.FILE, filepath: 'folder/blog.html' },
        {
          type: STAT_TYPES.DIRECTORY,
          files: ['folder/image1.png', 'folder/image2.png'],
          filepath: 'folder/templates2',
        },
        {
          type: STAT_TYPES.SYMBOLIC_LINK,
          filepath: 'folder/module.html',
        },
        { filepath: 'folder/page.html' },
        { type: '', filepath: 'folder/email.html' },
      ];

      const filesList = flattenAndRemoveSymlinks(filesData);
      expect(filesList.length).toBe(3);
      // Filters sym links and fileData without a type
      expect(filesList.includes('folder/module.html')).toBe(false);
      expect(filesList.includes('folder/page.html')).toBe(false);
      expect(filesList.includes('folder/email.html')).toBe(false);
    });
  });
});
