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
  // 'description' is specific to Sections
  description: 'description',
};

const getAnnotationValue = (annotations, key) => {
  const valueRegex = new RegExp(`${key}${ANNOTATION_VALUE_REGEX}`);
  const match = annotations.match(valueRegex);
  return match ? match[1].trim() : null;
};

const buildAnnotationValueGetter = file => {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (e) {
    logger.error(`Error reading file annotations ${file}`);
    return;
  }
  const match = source.match(ANNOTATIONS_REGEX);
  const annotation = match && match[1] ? match[1] : '';
  return annotationKey => getAnnotationValue(annotation, annotationKey);
};

/*
 * Returns true if:
 * .html extension (ignoring module.html)
 */
const isCodedFile = filePath => TEMPLATE_EXTENSION_REGEX.test(filePath);

module.exports = {
  ANNOTATION_KEYS,
  getAnnotationValue,
  buildAnnotationValueGetter,
  isCodedFile,
};
