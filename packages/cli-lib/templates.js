const fs = require('fs-extra');
const path = require('path');
const { i18n } = require('./lib/lang');
const { logger } = require('./logger');
const { downloadGitHubRepoContents } = require('./github');

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
  return getAnnotationsFromSource(source);
};

const getAnnotationsFromSource = source => {
  const match = source.match(ANNOTATIONS_REGEX);
  const annotation = match && match[1] ? match[1] : '';
  return annotationKey => getAnnotationValue(annotation, annotationKey);
};

/*
 * Returns true if:
 * .html extension (ignoring module.html)
 */
const isCodedFile = filePath => TEMPLATE_EXTENSION_REGEX.test(filePath);

// TODO - Update these paths to cli-assets in subsequent PR that removes old files
const ASSET_PATHS = {
  'page-template': 'packages/cli-lib/defaults/page-template.html',
  partial: 'packages/cli-lib/defaults/partial.html',
  'global-partial': 'packages/cli-lib/defaults/global-partial.html',
  'email-template': 'packages/cli-lib/defaults/email-template.html',
  'blog-listing-template':
    'packages/cli-lib/defaults/blog-listing-template.html',
  'blog-post-template': 'packages/cli-lib/defaults/blog-post-template.html',
  'search-template': 'packages/cli-lib/defaults/search-template.html',
};

const createTemplate = async (name, dest, type = 'page-template') => {
  const assetPath = ASSET_PATHS[type];
  const filename = name.endsWith('.html') ? name : `${name}.html`;
  const filePath = path.join(dest, filename);
  if (fs.existsSync(filePath)) {
    logger.error(
      i18n('cli.lib.errors.templates.pathExists', {
        path: filePath,
      })
    );
    return;
  }
  logger.debug(
    i18n('cli.lib.debug.templates.creatingPath', {
      path: dest,
    })
  );
  fs.mkdirp(dest);
  logger.log(
    i18n('cli.lib.logging.templates.creatingFile', {
      path: filePath,
    })
  );
  await downloadGitHubRepoContents('hubspot-cli', assetPath, filePath);
};

module.exports = {
  ANNOTATION_KEYS,
  createTemplate,
  getAnnotationValue,
  getAnnotationsFromSource,
  buildAnnotationValueGetter,
  isCodedFile,
};
