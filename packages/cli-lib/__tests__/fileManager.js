const { uploadFolder } = require('../fileManager');
const { uploadFile } = require('../api/fileManager');
const { walk } = require('../lib/walk');
const { createIgnoreFilter } = require('../ignoreRules');

jest.mock('../lib/walk');
jest.mock('../api/fileManager');
jest.mock('../ignoreRules');

describe('uploadFolder', () => {
  describe('uploadFolder()', () => {
    it('uploads files in the folder', async () => {
      const files = [
        'folder/document.pdf',
        'folder/images/image.png',
        'folder/images/image.jpg',
        'folder/video/video.mp4',
      ];

      walk.mockResolvedValue(files);
      uploadFile.mockImplementation(() => Promise.resolve());
      createIgnoreFilter.mockImplementation(() => () => true);

      const accountId = 123;
      const src = 'folder';
      const dest = 'folder';

      await uploadFolder(accountId, src, dest);

      expect(uploadFile).toReturnTimes(4);

      files.forEach((file, index) => {
        expect(uploadFile).nthCalledWith(index + 1, accountId, file, file);
      });
    });
  });
});
