const fs = require('fs');
const { logger } = require('./logger');

// Matches the .html file extension, excluding module.html
const TEMPLATE_EXTENSION_REGEX = new RegExp(/(?<!module)\.html$/);
// Matches the comment brackets that wrap annotations
const ANNOTATIONS_REGEX = /<!--([\s\S]*?)-->/;
// Matches an annotation value, ending at space, newline, or end of string
const ANNOTATION_VALUE_REGEX = ':\\s?([\\S|\\s]*?)(\n|$)';

const ANNOTATION_KEYS = {
  isAvailableForNewContent: 'isAvailableForNewContent',
  templateType: 'templateType',
  label: 'label',
  screenshotPath: 'screenshotPath',
};

const getFileAnnotations = filePath => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const match = data.match(ANNOTATIONS_REGEX);
    const annotation = match && match[1] ? match[1] : '';
    return annotation;
  } catch (err) {
    logger.debug(err);
    return '';
  }
};

const getAnnotationValue = (annotations, key) => {
  const valueRegex = new RegExp(`${key}${ANNOTATION_VALUE_REGEX}`);
  const match = annotations.match(valueRegex);
  return match ? match[1].trim() : null;
};

/*
 * Returns true if:
 * .html extension (ignoring module.html)
 * isAvailableForNewContent is null or true
 * templateType is NOT 'global_partial' or 'none'
 */
const isTemplate = filePath => {
  if (TEMPLATE_EXTENSION_REGEX.test(filePath)) {
    const annotations = getFileAnnotations(filePath);
    if (!annotations.length) {
      return false;
    }

    const templateType = getAnnotationValue(
      annotations,
      ANNOTATION_KEYS.templateType
    );
    const isAvailableForNewContent = getAnnotationValue(
      annotations,
      ANNOTATION_KEYS.isAvailableForNewContent
    );

    return (
      isAvailableForNewContent !== 'false' &&
      !['global_partial', 'none'].includes(templateType)
    );
  }
  return false;
};

module.exports = {
  ANNOTATION_KEYS,
  getAnnotationValue,
  getFileAnnotations,
  isTemplate,
};
