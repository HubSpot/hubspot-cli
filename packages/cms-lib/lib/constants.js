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

module.exports = {
  Mode,
  ALLOWED_EXTENSIONS,
  HUBL_EXTENSIONS,
  MODULE_EXTENSION,
  DEFAULT_MODE,
};
