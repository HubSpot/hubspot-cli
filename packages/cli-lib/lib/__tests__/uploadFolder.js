const path = require('path');
const { uploadFolder, getFilesByType, FileTypes } = require('../uploadFolder');
const { upload } = require('../../api/fileMapper');
const { walk, listFilesInDir } = require('../walk');
const { createIgnoreFilter } = require('../../ignoreRules');
const {
  FieldsJs,
  isProcessableFieldsJs,
  cleanupTmpDirSync,
  createTmpDirSync,
} = require('../handleFieldsJs');
const { logger } = require('../../logger');
const { logApiUploadErrorInstance } = require('../../errorHandlers');

jest.mock('../walk');
jest.mock('../../api/fileMapper');
jest.mock('../../ignoreRules');
jest.mock('../handleFieldsJs');
jest.mock('../../errorHandlers');

//folder/fields.js -> folder/fields.converted.js
// We add the .converted to differentiate from a unconverted fields.json

const defaultFieldsJsImplementation = jest.fn((src, filePath, rootWriteDir) => {
  const fieldsJs = Object.create(FieldsJs.prototype);
  return Object.assign(fieldsJs, {
    src,
    outputPath:
      filePath.substring(0, filePath.lastIndexOf('.')) + '.converted.json',
    rootWriteDir,
  });
});

isProcessableFieldsJs.mockImplementation((src, filePath) => {
  const fileName = path.basename(filePath);
  return fileName === 'fields.js';
});

const filesProto = [
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

describe('uploadFolder', () => {
  beforeAll(() => {
    createIgnoreFilter.mockImplementation(() => () => true);
  });
  beforeEach(() => {
    FieldsJs.mockReset();
    createTmpDirSync.mockReset();
  });
  describe('uploadFolder()', () => {
    const defaultParams = [
      '123',
      'folder',
      'folder',
      { mode: 'publish' },
      { saveOutput: true, processFieldsJs: false },
    ];

    it('uploads files in the correct order', async () => {
      FieldsJs.mockImplementation(defaultFieldsJsImplementation);
      listFilesInDir.mockReturnValue(['fields.json']);
      walk.mockResolvedValue(filesProto);
      upload.mockImplementation(() => Promise.resolve());

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

      await uploadFolder(...defaultParams);
      expect(upload).toReturnTimes(11);
      uploadedFilesInOrder.forEach((file, index) => {
        expect(upload).nthCalledWith(index + 1, defaultParams[0], file, file, {
          qs: { buffer: false, environmentId: 1 },
        });
      });
    });

    it('catches non-fatal upload errors and retries, and if fails again, logs.', async () => {
      const uploadMock = jest.fn().mockRejectedValue(new Error('Async error'));
      const logSpy = jest.spyOn(logger, 'debug');
      const file = 'folder/test.json';

      FieldsJs.mockImplementation(defaultFieldsJsImplementation);
      logApiUploadErrorInstance.mockImplementation(() => {});
      upload.mockImplementation(uploadMock);
      walk.mockResolvedValue([file]);

      await uploadFolder(...defaultParams);
      expect(logSpy).toHaveBeenCalledWith(
        'Retrying to upload file "%s" to "%s"',
        file,
        file
      );
      expect(logApiUploadErrorInstance).toHaveBeenCalled();
    });

    it('does not create a temp directory if --processFieldsJs is false', async () => {
      const tmpDirSpy = createTmpDirSync.mockImplementation(() => {});
      const params = [...defaultParams];
      params[4] = { saveOutput: true, processFieldsJs: true };

      FieldsJs.mockImplementation(defaultFieldsJsImplementation);
      walk.mockResolvedValue([]);
      upload.mockImplementation(() => Promise.resolve());

      await uploadFolder(...params);
      expect(tmpDirSpy).toHaveBeenCalled();
    });

    it('tries to save output of each fields file', async () => {
      const saveOutputSpy = jest.spyOn(FieldsJs.prototype, 'saveOutput');
      const params = [...defaultParams];
      params[4] = { saveOutput: true, processFieldsJs: true };

      FieldsJs.mockImplementation((src, filePath, rootWriteDir) => {
        const outputPath =
          filePath.substring(0, filePath.lastIndexOf('.')) + '.converted.json';
        const fieldsJs = Object.create(FieldsJs.prototype);
        return Object.assign(fieldsJs, {
          getOutputPathPromise: jest.fn(() => outputPath),
          src,
          outputPath,
          rootWriteDir,
        });
      });

      createTmpDirSync.mockReturnValue('folder');
      walk.mockResolvedValue([
        'folder/fields.js',
        'folder/sample.module/fields.js',
      ]);
      upload.mockImplementation(() => Promise.resolve());

      await uploadFolder(...params);
      expect(saveOutputSpy).toHaveBeenCalledTimes(2);
    });

    it('deletes the temporary directory', async () => {
      const deleteDirSpy = cleanupTmpDirSync.mockImplementation(() => {});
      const params = [...defaultParams];
      params[4] = { saveOutput: true, processFieldsJs: true };

      FieldsJs.mockImplementation(defaultFieldsJsImplementation);
      walk.mockResolvedValue([]);
      upload.mockImplementation(() => Promise.resolve());

      await uploadFolder(...params);
      expect(deleteDirSpy).toHaveBeenCalledWith('folder');
    });
  });

  describe('getFilesByType()', () => {
    beforeEach(() => {
      FieldsJs.mockImplementation(defaultFieldsJsImplementation);
      jest.resetModules();
    });
    it('outputs getFilesByType with no processing if processFieldsJs is false', () => {
      let files = [...filesProto];
      files.push('folder/sample.module/fields.js');
      const [filesByType] = getFilesByType(files, 'folder', 'folder', false);

      expect(filesByType).toEqual({
        [FileTypes.other]: [
          'folder/images/image.png',
          'folder/images/image.jpg',
        ],
        [FileTypes.module]: [
          'folder/sample.module/module.css',
          'folder/sample.module/module.js',
          'folder/sample.module/meta.json',
          'folder/sample.module/module.html',
          'folder/sample.module/fields.js',
        ],
        [FileTypes.cssAndJs]: ['folder/css/file.css', 'folder/js/file.js'],
        [FileTypes.template]: [
          'folder/templates/blog.html',
          'folder/templates/page.html',
        ],
        [FileTypes.json]: ['folder/fields.json'],
      });
    });

    it('finds and converts fields.js files to field.json', () => {
      const files = [...filesProto];
      files.push('folder/fields.js', 'folder/sample.module/fields.js');
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
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
        {
          outputPath: 'folder/sample.module/fields.converted.json',
          rootWriteDir: 'folder',
          src: 'folder',
        },
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

    it('does not add fields.json if fields.js is present in same directory', () => {
      const files = ['folder/fields.js', 'folder/fields.json'];
      const [filesByType] = getFilesByType(files, 'folder', 'folder', true);
      expect(filesByType).not.toMatchObject({
        [FileTypes.json]: ['folder/fields.json'],
      });
    });

    it('adds root fields.js to jsonFiles', () => {
      const files = ['folder/fields.js'];
      const converted = {
        outputPath: 'folder/fields.converted.json',
        rootWriteDir: 'folder',
        src: 'folder',
      };
      const [filesByType, compiledJsonFiles] = getFilesByType(
        files,
        'folder',
        'folder',
        true
      );

      expect(filesByType).toMatchObject({
        [FileTypes.json]: [converted],
      });

      expect(compiledJsonFiles).toEqual([converted]);
    });

    it('adds module fields.js to moduleFiles', () => {
      const files = ['folder/sample.module/fields.js'];
      const converted = {
        outputPath: 'folder/sample.module/fields.converted.json',
        rootWriteDir: 'folder',
        src: 'folder',
      };
      const [filesByType, compiledJsonFiles] = getFilesByType(
        files,
        'folder',
        'folder',
        true
      );

      expect(filesByType).toMatchObject({
        [FileTypes.module]: [converted],
      });

      expect(compiledJsonFiles).toEqual([converted]);
    });
  });
});
