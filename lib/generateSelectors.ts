import fs from 'fs';
import { logger } from '@hubspot/local-dev-lib/logger';

import { EXIT_CODES } from './enums/exitCodes';
import { i18n } from './lang';

const CSS_COMMENTS_REGEX = new RegExp(/\/\*.*\*\//, 'g');
const CSS_PSEUDO_CLASS_REGEX = new RegExp(
  /:active|:checked|:disabled|:empty|:enabled|:first-of-type|:focus|:hover|:in-range|:invalid|:link|:optional|:out-of-range|:read-only|:read-write|:required|:target|:valid|:visited/,
  'g'
);

let maxFieldsDepth = 0;

export function getMaxFieldsDepth(): number {
  return maxFieldsDepth;
}

export function findFieldsJsonPath(basePath: string): string | null {
  const _path = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (!fs.existsSync(_path)) {
    logger.error(
      i18n(`commands.theme.subcommands.generateSelectors.errors.invalidPath`, {
        themePath: basePath,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }
  const files = fs.readdirSync(_path);

  if (files.includes('fields.json')) {
    return `${_path}/fields.json`;
  }

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const isDirectory = fs.lstatSync(`${_path}/${fileName}`).isDirectory();

    if (isDirectory && !fileName.includes('.module')) {
      const fieldsJsonPath = findFieldsJsonPath(`${_path}/${fileName}`);
      if (fieldsJsonPath) return fieldsJsonPath;
    }
  }

  return null;
}

export function combineThemeCss(
  basePath: string,
  cssString = ''
): string | null {
  const _path = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const isDirectory = fs.lstatSync(_path).isDirectory();

  if (isDirectory) {
    const filesList = fs.readdirSync(_path);
    return filesList.reduce((css, fileName) => {
      const newCss = combineThemeCss(`${_path}/${fileName}`);
      return newCss ? `${css}\n${newCss}` : css;
    }, cssString);
  } else if (_path.includes('.css') && !_path.includes('.module')) {
    return `${cssString}\n${fs.readFileSync(_path, 'utf8')}`;
  }

  return null;
}

type Field = {
  name: string;
  children: Field[];
  selectors?: string[];
  inherited_value?: {
    property_value_paths?: {
      [key: string]: string;
    };
  };
};

export function setPreviewSelectors(
  fields: Field[],
  fieldPath: string[],
  selectors: string[],
  depth = 0
): Field[] {
  fields.forEach((field, index) => {
    if (field.name === fieldPath[0]) {
      if (field.children && fieldPath.length > 0) {
        fields[index].children = setPreviewSelectors(
          fields[index].children,
          fieldPath.splice(1),
          selectors,
          (depth += 1)
        );
      } else {
        if (!field.selectors) field.selectors = [];

        if (depth > maxFieldsDepth) {
          maxFieldsDepth = depth;
        }

        selectors.forEach(selector => {
          const fieldSelectors = field.selectors!;
          selector = selector.replace(CSS_COMMENTS_REGEX, '');
          selector = selector.replace(CSS_PSEUDO_CLASS_REGEX, '').trim();

          if (
            !fieldSelectors.includes(selector) &&
            !selector.includes('@media')
          ) {
            field.selectors = fieldSelectors.concat(selector);
          }
        });
      }
    }
  });

  return fields;
}

export function generateInheritedSelectors(fields: Field[]): Field[] {
  let finalFieldsJson = [...fields];

  function _generateInheritedSelectors(fieldsToCheck: Field[]): void {
    fieldsToCheck.forEach(field => {
      if (field.children) {
        _generateInheritedSelectors(field.children);
      }

      const fieldInheritance =
        field.inherited_value && field.inherited_value.property_value_paths;
      const fieldSelectors = field.selectors;

      if (fieldSelectors && fieldInheritance) {
        Object.values(fieldInheritance).forEach(path => {
          const fieldPath = path.split('.');
          if (fieldPath[0] === 'theme') {
            finalFieldsJson = setPreviewSelectors(
              finalFieldsJson,
              fieldPath.splice(1),
              fieldSelectors
            );
          }
        });
      }
    });
  }

  _generateInheritedSelectors(fields);

  return finalFieldsJson;
}

type SelectorsMap = { [key: string]: string[] | undefined };

export function generateSelectorsMap(
  fields: Field[],
  fieldKey: string[] = []
): SelectorsMap {
  let selectorsMap: SelectorsMap = {};

  fields.forEach(field => {
    const { children, name, selectors } = field;
    const _fieldKey = [...fieldKey, name];

    if (field.children) {
      selectorsMap = {
        ...selectorsMap,
        ...generateSelectorsMap(children, _fieldKey),
      };
    } else {
      selectorsMap[_fieldKey.join('.')] = selectors;
    }
  });

  return selectorsMap;
}
