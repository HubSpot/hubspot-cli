import fs from 'fs';
import os from 'os';
import path from 'path';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';
import {
  combineThemeCss,
  findFieldsJsonPath,
  generateInheritedSelectors,
  generateSelectorsMap,
  setPreviewSelectors,
} from '../generateSelectors.js';

type TestField = Parameters<typeof generateSelectorsMap>[0][number];

const mockedUiLogger = vi.mocked(uiLogger);

function writeFile(filePath: string, contents = ''): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function buildLeaf(name: string, selectors?: string[]): TestField {
  return { name, selectors } as TestField;
}

describe('lib/generateSelectors', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-selectors-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('findFieldsJsonPath()', () => {
    it('should return the path to fields.json when it is in the base directory', () => {
      writeFile(path.join(tempDir, 'fields.json'), '[]');

      expect(findFieldsJsonPath(tempDir)).toBe(`${tempDir}/fields.json`);
    });

    it('should strip a trailing slash from the base path', () => {
      writeFile(path.join(tempDir, 'fields.json'), '[]');

      expect(findFieldsJsonPath(`${tempDir}/`)).toBe(`${tempDir}/fields.json`);
    });

    it('should find fields.json in a nested directory', () => {
      writeFile(path.join(tempDir, 'theme', 'config', 'fields.json'), '[]');

      expect(findFieldsJsonPath(tempDir)).toBe(
        `${tempDir}/theme/config/fields.json`
      );
    });

    it('should skip .module directories', () => {
      writeFile(path.join(tempDir, 'thing.module', 'fields.json'), '[]');

      expect(findFieldsJsonPath(tempDir)).toBeNull();
    });

    it('should return null when no fields.json exists', () => {
      writeFile(path.join(tempDir, 'theme', 'readme.md'));

      expect(findFieldsJsonPath(tempDir)).toBeNull();
    });

    it('should log an error and return null when the path does not exist', () => {
      const missingPath = path.join(tempDir, 'missing');

      expect(findFieldsJsonPath(missingPath)).toBeNull();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        commands.cms.subcommands.theme.subcommands.generateSelectors.errors.invalidPath(
          missingPath
        )
      );
    });
  });

  describe('combineThemeCss()', () => {
    it('should return the contents of a single css file', () => {
      const cssPath = path.join(tempDir, 'main.css');
      writeFile(cssPath, '.a { color: red; }');

      expect(combineThemeCss(cssPath)).toContain('.a { color: red; }');
    });

    it('should combine css from every css file in a directory', () => {
      writeFile(path.join(tempDir, 'a.css'), '.a {}');
      writeFile(path.join(tempDir, 'b.css'), '.b {}');

      const css = combineThemeCss(tempDir);

      expect(css).toContain('.a {}');
      expect(css).toContain('.b {}');
    });

    it('should include css from nested directories', () => {
      writeFile(path.join(tempDir, 'css', 'nested.css'), '.nested {}');

      expect(combineThemeCss(tempDir)).toContain('.nested {}');
    });

    it('should ignore files that are not css', () => {
      writeFile(path.join(tempDir, 'a.css'), '.a {}');
      writeFile(path.join(tempDir, 'readme.md'), 'not css');

      expect(combineThemeCss(tempDir)).not.toContain('not css');
    });

    it('should ignore css inside .module directories', () => {
      writeFile(path.join(tempDir, 'a.css'), '.a {}');
      writeFile(path.join(tempDir, 'thing.module', 'module.css'), '.mod {}');

      expect(combineThemeCss(tempDir)).not.toContain('.mod {}');
    });

    it('should return null for a file that is not css', () => {
      const textPath = path.join(tempDir, 'readme.md');
      writeFile(textPath, 'hello');

      expect(combineThemeCss(textPath)).toBeNull();
    });

    it('should throw when the path does not exist', () => {
      expect(() => combineThemeCss(path.join(tempDir, 'missing'))).toThrow();
    });
  });

  describe('setPreviewSelectors()', () => {
    it('should add selectors to the field at the given path', () => {
      const fields = [buildLeaf('color')];

      const result = setPreviewSelectors(fields, ['color'], ['.a', '.b']);

      expect(result[0].selectors).toEqual(['.a', '.b']);
    });

    it('should add selectors to a nested field', () => {
      const fields = [
        { name: 'global', children: [buildLeaf('primary')] },
      ] as TestField[];

      const result = setPreviewSelectors(fields, ['global', 'primary'], ['.a']);

      expect(result[0].children[0].selectors).toEqual(['.a']);
    });

    it('should not modify fields that do not match the path', () => {
      const fields = [buildLeaf('color'), buildLeaf('font')];

      const result = setPreviewSelectors(fields, ['color'], ['.a']);

      expect(result[1].selectors).toBeUndefined();
    });

    it('should strip pseudo classes from selectors', () => {
      const fields = [buildLeaf('color')];

      const result = setPreviewSelectors(
        fields,
        ['color'],
        ['.btn:hover', '.link:visited']
      );

      expect(result[0].selectors).toEqual(['.btn', '.link']);
    });

    it('should strip css comments from selectors', () => {
      const fields = [buildLeaf('color')];

      const result = setPreviewSelectors(
        fields,
        ['color'],
        ['.btn /* primary */']
      );

      expect(result[0].selectors).toEqual(['.btn']);
    });

    it('should skip selectors containing @media', () => {
      const fields = [buildLeaf('color')];

      const result = setPreviewSelectors(
        fields,
        ['color'],
        ['@media (max-width: 100px)', '.a']
      );

      expect(result[0].selectors).toEqual(['.a']);
    });

    it('should not add duplicate selectors', () => {
      const fields = [buildLeaf('color', ['.a'])];

      const result = setPreviewSelectors(fields, ['color'], ['.a', '.b', '.b']);

      expect(result[0].selectors).toEqual(['.a', '.b']);
    });

    it('should not add a selector that is a duplicate once pseudo classes are stripped', () => {
      const fields = [buildLeaf('color', ['.a'])];

      const result = setPreviewSelectors(fields, ['color'], ['.a:hover']);

      expect(result[0].selectors).toEqual(['.a']);
    });

    it('should track the maximum depth of fields that received selectors', async () => {
      vi.resetModules();
      const freshModule = await import('../generateSelectors.js');
      const fields = [
        {
          name: 'one',
          children: [{ name: 'two', children: [buildLeaf('three')] }],
        },
      ] as TestField[];

      freshModule.setPreviewSelectors(fields, ['one', 'two', 'three'], ['.a']);

      expect(freshModule.getMaxFieldsDepth()).toBe(2);
    });
  });

  describe('generateInheritedSelectors()', () => {
    function buildThemeFields(): TestField[] {
      return [
        {
          name: 'global',
          children: [buildLeaf('primary')],
        },
        {
          name: 'button',
          children: [
            {
              name: 'background',
              selectors: ['.btn'],
              inherited_value: {
                property_value_paths: { color: 'theme.global.primary' },
              },
            },
          ],
        },
      ] as TestField[];
    }

    it('should copy selectors onto the theme field a field inherits from', () => {
      const result = generateInheritedSelectors(buildThemeFields());

      expect(result[0].children[0].selectors).toEqual(['.btn']);
    });

    it('should ignore inherited paths that do not start with theme', () => {
      const fields = buildThemeFields();
      fields[1].children[0].inherited_value = {
        property_value_paths: { color: 'other.global.primary' },
      };

      const result = generateInheritedSelectors(fields);

      expect(result[0].children[0].selectors).toBeUndefined();
    });

    it('should ignore fields that have no selectors', () => {
      const fields = buildThemeFields();
      fields[1].children[0].selectors = undefined;

      const result = generateInheritedSelectors(fields);

      expect(result[0].children[0].selectors).toBeUndefined();
    });

    it('should ignore fields that do not inherit a value', () => {
      const fields = buildThemeFields();
      fields[1].children[0].inherited_value = undefined;

      const result = generateInheritedSelectors(fields);

      expect(result[0].children[0].selectors).toBeUndefined();
    });
  });

  describe('generateSelectorsMap()', () => {
    it('should map a top level field name to its selectors', () => {
      const fields = [buildLeaf('color', ['.a'])];

      expect(generateSelectorsMap(fields)).toEqual({ color: ['.a'] });
    });

    it('should join nested field names with dots', () => {
      const fields = [
        {
          name: 'global',
          children: [buildLeaf('primary', ['.a']), buildLeaf('secondary')],
        },
      ] as TestField[];

      expect(generateSelectorsMap(fields)).toEqual({
        'global.primary': ['.a'],
        'global.secondary': undefined,
      });
    });

    it('should prefix keys with the provided field key', () => {
      const fields = [buildLeaf('primary', ['.a'])];

      expect(generateSelectorsMap(fields, ['theme', 'global'])).toEqual({
        'theme.global.primary': ['.a'],
      });
    });

    it('should return an empty map when there are no fields', () => {
      expect(generateSelectorsMap([])).toEqual({});
    });
  });
});
