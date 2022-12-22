const {
  fieldsArrayToJson,
  FieldsJs,
  isConvertableFieldJs,
} = require('../handleFieldsJs');
const fs = require('fs-extra');
const child_process = require('child_process');

// jest.mock('fs-extra', () => {
//   const original = jest.requireActual('fs-extra');
//   return {
//     ...original,
//     outputFileSync: () => jest.fn(),
//   };
// });
jest.mock('../walk');
jest.mock('../../api/fileMapper');
jest.mock('../../ignoreRules');
jest.mock('child_process');
// jest.mock('@hubspot/cli-lib/path', () => {
//   const cliLibPath = jest.requireActual('@hubspot/cli-lib/path');
//   return {
//     ...cliLibPath,
//     getCwd: jest.fn().mockReturnValue('test-cwd'),
//   };
// });

describe('handleFieldsJs', () => {
  describe('FieldsJs', () => {
    beforeEach(() => {
      child_process.fork.mockImplementation(() => {
        return {
          pid: 123,
          on: () => {
            return {};
          },
        };
      });
      jest.resetModules();
    });

    const projectRoot = 'folder';
    const filePath = 'folder/sample.module/fields.js';
    const defaultFieldsJs = new FieldsJs(projectRoot, filePath);
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

  describe('isConvertableFieldJs()', () => {
    const src = 'folder';

    it('returns true for root fields.js files', () => {
      const filePath = 'folder/fields.js';
      const returned = isConvertableFieldJs(src, filePath, true);
      expect(returned).toBe(true);
    });

    it('returns true for module fields.js files', () => {
      const filePath = 'folder/sample.module/fields.js';
      const returned = isConvertableFieldJs(src, filePath, true);
      expect(returned).toBe(true);
    });

    it('is false for fields.js files outside of root or module', () => {
      const filePath = 'folder/js/fields.js';
      const returned = isConvertableFieldJs(src, filePath, true);
      expect(returned).toBe(false);
    });

    it('returns false for any other file name', () => {
      expect(isConvertableFieldJs(src, 'folder/fields.json')).toBe(false);
      expect(
        isConvertableFieldJs(src, 'folder/sample.module/fields.json', true)
      ).toBe(false);
      expect(isConvertableFieldJs(src, 'folder/js/example.js', true)).toBe(
        false
      );
    });
  });
});
