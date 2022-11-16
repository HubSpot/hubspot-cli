const path = require('path');
const { uploadFolder, getFilesByType, FileTypes } = require('../uploadFolder');
const { upload } = require('../../api/fileMapper');
const { walk, listFilesInDir } = require('../walk');
const { createIgnoreFilter } = require('../../ignoreRules');
const {
  FieldsJs,
  isConvertableFieldJs,
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
  const outputPath =
    filePath.substring(0, filePath.lastIndexOf('.')) + '.converted.json';
  return {
    init: jest.fn().mockReturnValue(
      Object.assign(fieldsJs, {
        src,
        outputPath,
        rootWriteDir,
        getOutputPathPromise: jest.fn().mockResolvedValue(outputPath),
        rejected: false,
      })
    ),
  };
});
FieldsJs.mockImplementation(defaultFieldsJsImplementation);

isConvertableFieldJs.mockImplementation((src, filePath) => {
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
    FieldsJs.mockClear();
    createTmpDirSync.mockReset();
    listFilesInDir.mockReset();
  });

  describe('uploadFolder()', () => {
    const defaultParams = [
      '123',
      'folder',
      'folder',
      { mode: 'publish' },
      { saveOutput: true, convertFields: false },
    ];

    it('uploads files in the correct order', async () => {
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

      await uploadFolder(...defaultParams, uploadedFilesInOrder);
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

      logApiUploadErrorInstance.mockImplementation(() => {});
      upload.mockImplementation(uploadMock);

      await uploadFolder(...defaultParams, [file]);
      expect(logSpy).toHaveBeenCalledWith(
        'Retrying to upload file "%s" to "%s"',
        file,
        file
      );
      expect(logApiUploadErrorInstance).toHaveBeenCalled();
    });

    it('does not create a temp directory if --convertFields is false', async () => {
      const tmpDirSpy = createTmpDirSync.mockImplementation(() => {});
      const params = [...defaultParams];
      params[4] = { saveOutput: true, convertFields: true };

      upload.mockImplementation(() => Promise.resolve());

      await uploadFolder(...params, []);
      expect(tmpDirSpy).toHaveBeenCalled();
    });

    it('tries to save output of each fields file', async () => {
      const saveOutputSpy = jest.spyOn(FieldsJs.prototype, 'saveOutput');
      const params = [...defaultParams];
      params[4] = { saveOutput: true, convertFields: true };

      createTmpDirSync.mockReturnValue('folder');
      upload.mockImplementation(() => Promise.resolve());

      await uploadFolder(...params, [
        'folder/fields.js',
        'folder/sample.module/fields.js',
      ]);
      expect(saveOutputSpy).toHaveBeenCalledTimes(2);
    });

    it('deletes the temporary directory', async () => {
      const deleteDirSpy = cleanupTmpDirSync.mockImplementation(() => {});
      const params = [...defaultParams];
      params[4] = { saveOutput: true, convertFields: true };

      upload.mockImplementation(() => Promise.resolve());

      await uploadFolder(...params, []);
      expect(deleteDirSpy).toHaveBeenCalledWith('folder');
    });
  });

  describe('getFilesByType()', () => {
    const convertedFieldsObj = new FieldsJs(
      'folder',
      'folder/fields.json',
      'folder'
    ).init();
    const convertedFilePath = convertedFieldsObj.outputPath;

    const convertedModuleFieldsObj = new FieldsJs(
      'folder',
      'folder/sample.module/fields.json',
      'folder'
    ).init();
    const convertedModuleFilePath = convertedModuleFieldsObj.outputPath;

    beforeEach(() => {
      FieldsJs.mockClear();
      jest.resetModules();
    });
    it('outputs getFilesByType with no processing if convertFields is false', async () => {
      let files = [...filesProto];
      files.push('folder/sample.module/fields.js');
      const [filesByType] = await getFilesByType(files, 'folder', 'folder', {
        convertFields: false,
      });

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

    it('finds and converts fields.js files to field.json', async () => {
      const files = [...filesProto];
      files.push('folder/fields.js', 'folder/sample.module/fields.js');
      listFilesInDir.mockReturnValue(['fields.json']);
      let [filesByType, fieldsJsObjects] = await getFilesByType(
        files,
        'folder',
        'folder',
        { convertFields: true }
      );

      filesByType = Object.values(filesByType);
      expect(filesByType[1]).toEqual([
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
        convertedModuleFilePath,
      ]);
      expect(filesByType[4]).toContainEqual(convertedFilePath);
      expect(JSON.stringify(fieldsJsObjects)).toBe(
        JSON.stringify([convertedFieldsObj, convertedModuleFieldsObj])
      );
    });

    it('does not add fields.json if fields.js is present in same directory', async () => {
      const files = ['folder/fields.js', 'folder/fields.json'];
      listFilesInDir.mockReturnValue(['fields.json', 'fields.js']);
      const [filesByType] = await getFilesByType(files, 'folder', 'folder', {
        convertFields: true,
      });
      expect(filesByType).not.toMatchObject({
        [FileTypes.json]: ['folder/fields.json'],
      });
    });

    it('adds root fields.js to jsonFiles', async () => {
      const files = ['folder/fields.js'];
      const [filesByType, fieldsJsObjects] = await getFilesByType(
        files,
        'folder',
        'folder',
        { convertFields: true }
      );
      expect(filesByType).toMatchObject({
        [FileTypes.json]: [convertedFilePath],
      });

      expect(JSON.stringify(fieldsJsObjects)).toEqual(
        JSON.stringify([convertedFieldsObj])
      );
    });

    it('adds module fields.js to moduleFiles', async () => {
      const files = ['folder/sample.module/fields.js'];
      const [filesByType, fieldsJsObjects] = await getFilesByType(
        files,
        'folder',
        'folder',
        { convertFields: true }
      );

      expect(filesByType).toMatchObject({
        [FileTypes.module]: [convertedModuleFilePath],
      });

      expect(JSON.stringify(fieldsJsObjects)).toBe(
        JSON.stringify([convertedModuleFieldsObj])
      );
    });
  });
});
