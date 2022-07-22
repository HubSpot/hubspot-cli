const { fieldsArrayToJson } = require('../handleFieldsJs');
const { getFilesByType, resolvePromises } = require('../uploadFolder');
const { listFilesInDir } = require('../walk');
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
  describe('getFilesByType()', () => {
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
      const [filesByType, compiledJsonFiles] = await resolvePromises(
        getFilesByType(files, 'folder')
      );
      expect(filesByType[1]).toEqual([
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.converted.json',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ]);
      expect(filesByType[4]).toContain('folder/fields.converted.json');
      expect(compiledJsonFiles).toEqual(
        expect.arrayContaining([
          'folder/fields.converted.json',
          'folder/sample.module/fields.converted.json',
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

      const [filesByType] = await resolvePromises(
        getFilesByType(files, 'folder')
      );
      expect(filesByType[1]).toEqual([
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.converted.json',
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

      const [filesByType, compiledJsonFiles] = await resolvePromises(
        getFilesByType(files, 'folder')
      );
      expect(filesByType[4]).toEqual(['folder/fields.converted.json']);
      expect(compiledJsonFiles).toEqual(['folder/fields.converted.json']);
    });

    it('does not add any json files inside of module folder besides fields.json and meta.json', async () => {
      const files = [
        'folder/sample.module/module.css',
        'folder/sample.module/module.js',
        'folder/sample.module/fields.json',
        'folder/sample.module/dont_add.json',
        'folder/sample.module/meta.json',
        'folder/sample.module/module.html',
      ];
      listFilesInDir.mockReturnValue(['']);
      const [filesByType] = await resolvePromises(
        getFilesByType(files, 'folder')
      );
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
