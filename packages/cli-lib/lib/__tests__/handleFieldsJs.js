const { fieldsArrayToJson } = require('../handleFieldsJs');

jest.mock('../walk');
jest.mock('../../api/fileMapper');
jest.mock('../../ignoreRules');

describe('handleFieldsJs', () => {
  describe('FieldsJs', () => {
    it.todo('attempts to create a tmpDir if rootWriteDir is undefined');

    test.todo('createTmpDir() creates a tmpDir');

    test.todo('deleteDir() deletes directories');

    test.todo('saveOutput() sets the save path correctly');

    test.todo('getWriteDir() returns the correct path');
  });

  describe('convertFieldsJs()', () => {
    it.todo('changes the directory to the filePath dir');

    it.todo('changes the directory back to the original before exit');

    it.todo('sets the final path correctly');

    it.todo('returns a Promise');
  });

  describe('fieldsArrayToJson()', () => {
    it('flattens nested arrays', () => {
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

      const json = fieldsArrayToJson(input);

      expect(json).toEqual(JSON.stringify(expected));
    });

    it('handles objects with toJSON methods', () => {
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
      const json = fieldsArrayToJson(array);
      expect(json).toEqual(JSON.stringify(expected));
    });
  });

  describe('isProcessableFieldsJs()', () => {
    it.todo('returns true for root fields.js files');

    it.todo('returns true for module fields.js files');

    it.todo(
      'returns false for fields.js files outside of root or module folder'
    );

    it.todo('returns false for any other file name');
  });
});
