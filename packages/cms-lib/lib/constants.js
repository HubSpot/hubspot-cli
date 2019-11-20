const ALLOWED_EXTENSIONS = new Set([
  'css',
  'js',
  'json',
  'html',
  'txt',
  'md',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'map',
  'svg',
  'ttf',
  'woff',
  'woff2',
]);
const HUBL_EXTENSIONS = new Set(['css', 'html', 'js']);
const MODULE_EXTENSION = 'module';

/**
 * `draft` for buffer APIs.
 *
 * @enum {string}
 */
const Mode = {
  draft: 'draft',
  publish: 'publish',
};

const DEFAULT_MODE = Mode.publish;

const DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME = 'hubspot.config.yml';

module.exports = {
  Mode,
  ALLOWED_EXTENSIONS,
  HUBL_EXTENSIONS,
  MODULE_EXTENSION,
  DEFAULT_MODE,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
};
