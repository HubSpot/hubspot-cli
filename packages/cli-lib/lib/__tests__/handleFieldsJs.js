const { fieldsArrayToJson } = require('../handleFieldsJs');

describe('handleFieldsJs', () => {
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
});
