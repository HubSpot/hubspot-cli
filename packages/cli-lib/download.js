const path = require('path');
const fs = require('fs-extra');
const prettier = require('prettier');
const { fetchBuiltinMapping } = require('./api/designManager');
const { fetchModule } = require('./api/fileMapper');
const { logger } = require('./logger');

const META_KEYS_WHITELIST = new Set([
  'content_tags',
  'css_assets',
  'default',
  'editable_contexts',
  'external_js',
  'extra_classes',
  'global',
  'help_text',
  'host_template_types',
  'icon',
  'is_available_for_new_content',
  'js_assets',
  'label',
  'master_language',
  'other_assets',
  'smart_type',
  'tags',
]);

function cleanMetaJson(source) {
  const meta = JSON.parse(source);
  const out = {};
  META_KEYS_WHITELIST.forEach(key => {
    if (meta[key]) {
      out[key] = meta[key];
    }
  });

  return JSON.stringify(out);
}

function writeFiles(dest, tree) {
  if (tree.source) {
    let source = tree.source;
    if (path.basename(tree.path) === 'meta.json') {
      source = cleanMetaJson(source);
    }
    if (path.extname(tree.path) === '.json') {
      source = prettier.format(source, {
        parser: 'json',
      });
    }
    fs.outputFileSync(path.join(dest, tree.path), source);
    logger.debug('Wrote file %s', tree.path);
  }
  tree.children.forEach(subtree => writeFiles(dest, subtree));
}

async function downloadModule(accountId, moduleId, dest) {
  let response;
  try {
    response = await fetchModule(accountId, moduleId);
  } catch (error) {
    logger.error('Failed to download %s', moduleId);
    if (error.response && error.response.body) {
      logger.error(error.response.body);
    } else {
      logger.error(error.message);
    }
    return;
  }
  writeFiles(dest, response);
  logger.log('Downloaded %s', response.path);
}

async function downloadBuiltinModules(accountId, dest) {
  const builtinMappings = await fetchBuiltinMapping(accountId);
  const downloaded = new Set();
  Object.values(builtinMappings).forEach(moduleId => {
    if (downloaded.has(moduleId)) {
      return;
    }
    logger.log('Downloading module %s', moduleId);
    downloaded.add(moduleId);
    downloadModule(accountId, moduleId, dest);
    logger.error('Failed to download %s', moduleId);
  });
}

module.exports = {
  downloadModule,
  downloadBuiltinModules,
};
