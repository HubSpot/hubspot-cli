const { uploadFolder } = require('../uploadFolder');
const { upload } = require('../../api/fileMapper');
const { walk, listFilesInDir } = require('../walk');
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
        'folder/fields.json',
        'folder/images/image.png',
        'folder/images/image.jpg',
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
        'folder/templates/page.html',
      ];

      listFilesInDir.mockReturnValue(['fields.json']);
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
        'folder/fields.json',
      ];

      await uploadFolder(accountId, src, dest, { mode: 'publish' });

      expect(upload).toReturnTimes(11);

      uploadedFilesInOrder.forEach((file, index) => {
        expect(upload).nthCalledWith(index + 1, accountId, file, file, {
          qs: { buffer: false, environmentId: 1 },
        });
      });
    });

    it('converts fields.js files to field.json', () => {});

    it('does not upload field.json files from module folder if a field.js is present in module folder', () => {});

    it('does not upload root fields.json if a fields.js is present in root', () => {});

    it('does not upload any json files inside of module folder besides fields.json and meta.json', () => {});
  });
});
