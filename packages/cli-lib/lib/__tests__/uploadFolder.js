const { uploadFolder, getFilesByType } = require('../uploadFolder');
const { upload } = require('../../api/fileMapper');
const { walk, listFilesInDir } = require('../walk');
const { createIgnoreFilter } = require('../../ignoreRules');
const { convertFieldsJs } = require('../handleFieldsJs');

jest.mock('../walk');
jest.mock('../../api/fileMapper');
jest.mock('../../ignoreRules');
jest.mock('../handleFieldsJs');

//folder/fields.js -> folder/fields.converted.js
// We add the .converted to differentiate from a unconverted fields.json
convertFieldsJs.mockImplementation(
  file => file.substring(0, file.lastIndexOf('.')) + '.converted.json'
);

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
  });

  describe('getFilesByType()', () => {
    it('finds and converts fields.js files to field.json', () => {
      const files = [
        'folder/templates/blog.html',
        'folder/css/file.css',
        'folder/js/file.js',
        'folder/fields.js',
        'folder/images/image.png',
        'folder/images/image.jpg',
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.js',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
        'folder/templates/page.html',
      ];

      listFilesInDir.mockReturnValue(['fields.json']);

      return Promise.resolve(getFilesByType(files, 'folder')).then(
        ([filesByType, compiledJsonFiles]) => {
          expect(filesByType[1]).toEqual([
            'folder/sample.module/module.css',
            'folder/sample.module/module.js',
            'folder/sample.module/meta.json',
            'folder/sample.module/module.html',
            'folder/sample.module/fields.converted.json',
          ]);
          expect(filesByType[4]).toContain('folder/fields.converted.json');
          expect(compiledJsonFiles).toEqual(
            expect.arrayContaining([
              'folder/fields.converted.json',
              'folder/sample.module/fields.converted.json',
            ])
          );
        }
      );
    });

    it('does not add field.json files from module folder if a field.js is present in module folder', () => {
      const files = [
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.json',
        'folder/sample.module/fields.js',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ];
      listFilesInDir.mockImplementation(dir => {
        return dir === 'folder/sample.module' ? ['fields.js'] : [''];
      });

      return Promise.resolve(getFilesByType(files, 'folder')).then(data => {
        const filesByType = data[0];
        expect(filesByType[1]).toEqual([
          'folder/sample.module/module.css',
          'folder/sample.module/module.js',
          'folder/sample.module/meta.json',
          'folder/sample.module/module.html',
          'folder/sample.module/fields.converted.json',
        ]);
      });
    });

    it('converts fields.js in root and skips field.json in root', () => {
      const files = [
        'folder/fields.js',
        'folder/fields.json',
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.json',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ];
      listFilesInDir.mockImplementation(dir => {
        return dir === 'folder' ? ['fields.js', 'fields.json'] : [''];
      });

      return Promise.resolve(getFilesByType(files, 'folder')).then(
        ([filesByType, compiledJsonFiles]) => {
          expect(filesByType[4]).toEqual(['folder/fields.converted.json']);
          expect(compiledJsonFiles).toEqual(['folder/fields.converted.json']);
        }
      );
    });

    it('does not add any json files inside of module folder besides fields.json and meta.json', () => {
      const files = [
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.json',
        'folder/sample.module/dont_add.json',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ];
      listFilesInDir.mockReturnValue(['']);
      const filesByType = getFilesByType(files, 'folder')[0];
      expect(filesByType[1]).toEqual([
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.json',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ]);
    });
  });
});
