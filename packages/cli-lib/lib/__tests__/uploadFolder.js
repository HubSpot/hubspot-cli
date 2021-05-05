const { uploadFolder } = require('../uploadFolder');
const { upload } = require('../../api/fileMapper');
const { walk } = require('../walk');
const { createIgnoreFilter } = require('../../ignoreRules');

jest.mock('../walk');
jest.mock('../../api/fileMapper');
jest.mock('../../ignoreRules');

describe('uploadFolder', () => {
  describe('uploadFolder()', () => {
    it('uploads files in the correct order', async () => {
      const files = [
        'folder/templates/blog.html',
        'folder/css/file.css',
        'folder/js/file.js',
        'folder/images/image.png',
        'folder/images/image.jpg',
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
        'folder/templates/page.html',
      ];

      walk.mockResolvedValue(files);
      upload.mockImplementation(() => Promise.resolve());
      createIgnoreFilter.mockImplementation(() => () => true);

      const accountId = 123;
      const src = 'folder';
      const dest = 'folder';
      const uploadedFilesInOrder = [
        'folder/images/image.png',
        'folder/images/image.jpg',
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
        'folder/css/file.css',
        'folder/js/file.js',
        'folder/templates/blog.html',
        'folder/templates/page.html',
      ];

      await uploadFolder(accountId, src, dest, { mode: 'publish' });

      expect(upload).toReturnTimes(10);

      uploadedFilesInOrder.forEach((file, index) => {
        expect(upload).nthCalledWith(index + 1, accountId, file, file, {
          qs: { buffer: false, environmentId: 1 },
        });
      });
    });
  });
});
