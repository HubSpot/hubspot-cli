const fs = require('fs');
const { EXIT_CODES } = require('./enums/exitCodes');
const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('../lib/lang');

const CSS_COMMENTS_REGEX = new RegExp(/\/\*.*\*\//, 'g');
const CSS_PSEUDO_CLASS_REGEX = new RegExp(
  /:active|:checked|:disabled|:empty|:enabled|:first-of-type|:focus|:hover|:in-range|:invalid|:link|:optional|:out-of-range|:read-only|:read-write|:required|:target|:valid|:visited/,
  'g'
);
const i18nKey = 'cli.commands.theme.subcommands.generateSelectors';

let maxFieldsDepth = 0;

function getMaxFieldsDepth() {
  return maxFieldsDepth;
}

function findFieldsJsonPath(basePath) {
  const _path = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (!fs.existsSync(_path)) {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
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

function combineThemeCss(basePath, cssString = '') {
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

function setPreviewSelectors(fields, fieldPath, selectors, depth = 0) {
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
          const fieldSelectors = field.selectors;
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

function generateInheritedSelectors(fields) {
  let finalFieldsJson = [...fields];

  const _generateInheritedSelectors = fieldsToCheck => {
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
  };

  _generateInheritedSelectors(fields);

  return finalFieldsJson;
}

function generateSelectorsMap(fields, fieldKey = []) {
  let selectorsMap = {};

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

module.exports = {
  findFieldsJsonPath,
  combineThemeCss,
  setPreviewSelectors,
  generateInheritedSelectors,
  generateSelectorsMap,
  getMaxFieldsDepth,
};
