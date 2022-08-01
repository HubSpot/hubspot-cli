const path = require('path');
const { uploadFolder, getFilesByType } = require('../uploadFolder');
const { upload } = require('../../api/fileMapper');
const { walk, listFilesInDir } = require('../walk');
const { createIgnoreFilter } = require('../../ignoreRules');
const { FieldsJs, isProcessableFieldsJs } = require('../handleFieldsJs');

jest.mock('../walk');
jest.mock('../../api/fileMapper');
jest.mock('../../ignoreRules');
jest.mock('../handleFieldsJs');

//folder/fields.js -> folder/fields.converted.js
// We add the .converted to differentiate from a unconverted fields.json
FieldsJs.mockImplementation((src, filePath, rootWriteDir) => {
  return {
    src,
    outputPath:
      filePath.substring(0, filePath.lastIndexOf('.')) + '.converted.json',
    rootWriteDir,
  };
});

isProcessableFieldsJs.mockImplementation((src, filePath) => {
  const fileName = path.basename(filePath);
  return fileName === 'fields.js';
});

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
    beforeEach(() => {
      jest.resetModules();
    });
    it('finds and converts fields.js files to field.json', async () => {
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
      let [filesByType, compiledJsonFiles] = getFilesByType(
        files,
        'folder',
        'folder',
        true
      );
      filesByType = Object.values(filesByType);
      expect(filesByType[1]).toEqual([
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        {
          outputPath: 'folder/sample.module/fields.converted.json',
          rootWriteDir: 'folder',
          src: 'folder',
        },
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ]);
      expect(filesByType[4]).toContainEqual({
        outputPath: 'folder/fields.converted.json',
        rootWriteDir: 'folder',
        src: 'folder',
      });
      expect(compiledJsonFiles).toEqual(
        expect.arrayContaining([
          {
            outputPath: 'folder/fields.converted.json',
            rootWriteDir: 'folder',
            src: 'folder',
          },
          {
            outputPath: 'folder/sample.module/fields.converted.json',
            rootWriteDir: 'folder',
            src: 'folder',
          },
        ])
      );
    });

    it('does not add field.json files from module folder if a field.js is present in module folder', async () => {
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

      let [filesByType] = getFilesByType(files, 'folder', 'folder', true);
      filesByType = Object.values(filesByType);
      expect(filesByType[1]).toEqual([
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        {
          outputPath: 'folder/sample.module/fields.converted.json',
          rootWriteDir: 'folder',
          src: 'folder',
        },
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ]);
    });

    it('converts fields.js in root and skips field.json in root', async () => {
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

      let [filesByType, compiledJsonFiles] = getFilesByType(
        files,
        'folder',
        'folder',
        true
      );
      filesByType = Object.values(filesByType);
      expect(filesByType[4]).toEqual([
        {
          outputPath: 'folder/fields.converted.json',
          rootWriteDir: 'folder',
          src: 'folder',
        },
      ]);
      expect(compiledJsonFiles).toEqual([
        {
          outputPath: 'folder/fields.converted.json',
          rootWriteDir: 'folder',
          src: 'folder',
        },
      ]);
    });
  });
});
