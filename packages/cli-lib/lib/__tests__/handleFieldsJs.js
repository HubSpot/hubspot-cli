const {
  fieldsArrayToJson,
  FieldsJs,
  isProcessableFieldsJs,
} = require('../handleFieldsJs');
const fs = require('fs-extra');
const dynamicImport = require('../dynamicImport');

jest.mock('fs-extra');
jest.mock('../walk');
jest.mock('../../api/fileMapper');
jest.mock('../../ignoreRules');
jest.mock('@hubspot/cli-lib/path', () => {
  const cliLibPath = jest.requireActual('@hubspot/cli-lib/path');
  return {
    ...cliLibPath,
    getCwd: jest.fn().mockReturnValue('test-cwd'),
  };
});
jest.mock('../dynamicImport');
const dynamicImportSpy = jest.spyOn(dynamicImport, 'dynamicImport');
describe('handleFieldsJs', () => {
  describe('FieldsJs', () => {
    beforeEach(() => {
      dynamicImportSpy.mockImplementation(() => {
        return Promise.resolve(() => []);
      });
      chDirSpy.mockClear();
      jest.resetModules();
    });

    const testCwd = 'test-cwd';
    const projectRoot = 'folder';
    const filePath = 'folder/sample.module/fields.js';
    const defaultFieldsJs = new FieldsJs(projectRoot, filePath);
    const chDirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => {});
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    test('getOutputPathPromise() resolves to the correct path', async () => {
      const fieldsJs = new FieldsJs(
        'folder',
        'folder/sample.module/fields.js',
        'temp-dir'
      );
      const convertSpy = jest
        .spyOn(FieldsJs.prototype, 'convertFieldsJs')
        .mockResolvedValue('temp-dir/sample.module/fields.js');

      const returned = fieldsJs.getOutputPathPromise();
      await expect(returned).resolves.toBe('temp-dir/sample.module/fields.js');
      convertSpy.mockRestore();
    });

    test('getWriteDir() returns the correct path', () => {
      const fieldsJs = new FieldsJs(
        'folder',
        'folder/sample.module/fields.js',
        'temp-dir'
      );
      const returned = fieldsJs.getWriteDir();
      expect(returned).toBe('temp-dir/sample.module');
    });

    test('saveOutput() sets the save path correctly', () => {
      const copyFileSpy = jest.spyOn(fs, 'copyFileSync');
      const fieldsJs = new FieldsJs(
        'folder',
        'folder/sample.module/fields.js',
        'writeDir'
      );

      fieldsJs.outputPath = 'folder/sample.module/fields.js';

      fieldsJs.saveOutput();
      expect(copyFileSpy).toHaveBeenCalledWith(
        'folder/sample.module/fields.js',
        'folder/sample.module/fields.output.json'
      );
    });

    test('convertFieldsJs returns a Promise', () => {
      const returned = defaultFieldsJs.convertFieldsJs('');
      expect(returned).toBeInstanceOf(Promise);
    });

    test('convertFieldsJs changes the directory properly', async () => {
      await defaultFieldsJs.convertFieldsJs('temp-dir');
      expect(chDirSpy.mock.calls).toEqual([
        ['folder/sample.module'],
        [testCwd],
      ]);
    });

    test('convertFieldsJs sets the final path correctly', async () => {
      const writeDir = 'test-dir/sample.module';
      const returned = await defaultFieldsJs.convertFieldsJs(writeDir);
      expect(returned).toBe('test-dir/sample.module/fields.json');
    });

    test('convertFieldsJs errors if no function returned', async () => {
      dynamicImportSpy.mockReset();
      jest.spyOn(dynamicImport, 'dynamicImport').mockImplementation(() => {
        return Promise.resolve(null);
      });
      await defaultFieldsJs.convertFieldsJs('temp-dir');
      expect(defaultFieldsJs.rejected).toBe(true);
    });

    test('convertFieldsJs errors if no array returned', async () => {
      dynamicImportSpy.mockReset();
      jest.spyOn(dynamicImport, 'dynamicImport').mockImplementation(() => {
        return Promise.resolve(() => 'string');
      });
      await defaultFieldsJs.convertFieldsJs('temp-dir');
      expect(defaultFieldsJs.rejected).toBe(true);
    });

    // Not sure of a good way to do this ATM - mocking the require(filePath) is tricky.
    test.todo('convertFieldsJs throws SyntaxError if no array is given');
  });

  describe('fieldsArrayToJson()', () => {
    it('flattens nested arrays', async () => {
      let input = [
        [
          {
            type: 'text',
            name: 'test1',
            label: 'test1',
            children: [
              {
                type: 'text',
                name: 'test2',
                label: 'test2',
              },
            ],
          },
          {
            type: 'text',
            name: 'test3',
            label: 'test3',
            children: [
              {
                type: 'text',
                name: 'test4',
                label: 'test4',
              },
            ],
          },
        ],
        [
          [
            {
              type: 'text',
              name: 'test5',
              label: 'test5',
              supported_types: ['EXTERNAL', 'CONTENT', 'FILE', 'EMAIL_ADDRESS'],
            },
          ],
        ],
      ];

      const expected = [
        {
          type: 'text',
          name: 'test1',
          label: 'test1',
          children: [{ type: 'text', name: 'test2', label: 'test2' }],
        },
        {
          type: 'text',
          name: 'test3',
          label: 'test3',
          children: [{ type: 'text', name: 'test4', label: 'test4' }],
        },
        {
          type: 'text',
          name: 'test5',
          label: 'test5',
          supported_types: ['EXTERNAL', 'CONTENT', 'FILE', 'EMAIL_ADDRESS'],
        },
      ];

      const json = (await fieldsArrayToJson(input)).replace(/\s/g, '');

      expect(json).toEqual(JSON.stringify(expected));
    });

    it('handles objects with toJSON methods', async () => {
      const obj = {
        type: 'link',
        name: 'test',
        label: 'test',
        toJSON: function toJSON() {
          return { type: this.type };
        },
      };
      const array = [
        obj,
        {
          type: 'text',
          name: 'test',
          label: 'test',
        },
      ];
      const expected = [
        {
          type: 'link',
        },
        {
          type: 'text',
          name: 'test',
          label: 'test',
        },
      ];
      const json = (await fieldsArrayToJson(array)).replace(/\s/g, '');
      expect(json).toEqual(JSON.stringify(expected));
    });
  });

  describe('isProcessableFieldsJs()', () => {
    const src = 'folder';

    it('returns true for root fields.js files', () => {
      const filePath = 'folder/fields.js';
      const returned = isProcessableFieldsJs(src, filePath, true);
      expect(returned).toBe(true);
    });

    it('returns true for module fields.js files', () => {
      const filePath = 'folder/sample.module/fields.js';
      const returned = isProcessableFieldsJs(src, filePath, true);
      expect(returned).toBe(true);
    });

    it('is false for fields.js files outside of root or module', () => {
      const filePath = 'folder/js/fields.js';
      const returned = isProcessableFieldsJs(src, filePath, true);
      expect(returned).toBe(false);
    });

    it('returns false for any other file name', () => {
      expect(isProcessableFieldsJs(src, 'folder/fields.json')).toBe(false);
      expect(
        isProcessableFieldsJs(src, 'folder/sample.module/fields.json', true)
      ).toBe(false);
      expect(isProcessableFieldsJs(src, 'folder/js/example.js', true)).toBe(
        false
      );
    });
  });
});
