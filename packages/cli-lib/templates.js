const fs = require('fs');
const { logger } = require('./logger');

// Matches the .html file extension, excluding module.html
const TEMPLATE_EXTENSION_REGEX = new RegExp(/(?<!module)\.html$/);
// Matches files named module.html
const MODULE_HTML_EXTENSION_REGEX = new RegExp(/(\.module\/module\.html)/);
// Matches files named module.css
const MODULE_CSS_EXTENSION_REGEX = new RegExp(/(\.module\/module\.css)/);
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

const getAnnotationsFromSource = source => {
  const match = source.match(ANNOTATIONS_REGEX);
  const annotation = match && match[1] ? match[1] : '';
  return annotation;
};

const getAnnotationValue = (annotations, key) => {
  const valueRegex = new RegExp(`${key}${ANNOTATION_VALUE_REGEX}`);
  const match = annotations.match(valueRegex);
  return match ? match[1].trim() : null;
};

/*
 * Returns true if:
 * .html extension (ignoring module.html)
 */
const isCodedFile = filePath => TEMPLATE_EXTENSION_REGEX.test(filePath);

/*
 * Returns true if:
 * filename is module.html, inside of *.module folder
 */
const isModuleHTMLFile = filePath => MODULE_HTML_EXTENSION_REGEX.test(filePath);

/*
 * Returns true if:
 * filename is module.css, inside of *.module folder
 */
const isModuleCSSFile = filePath => MODULE_CSS_EXTENSION_REGEX.test(filePath);

module.exports = {
  ANNOTATION_KEYS,
  getAnnotationValue,
  getAnnotationsFromSource,
  getFileAnnotations,
  isCodedFile,
  isModuleCSSFile,
  isModuleHTMLFile,
};
