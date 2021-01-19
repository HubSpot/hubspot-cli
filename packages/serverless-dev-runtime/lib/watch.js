const chokidar = require('chokidar');
const { logger } = require('@hubspot/cli-lib/logger');

function watch(src, action) {
  const watcher = chokidar.watch(src);

  watcher.on('ready', () => {
    logger.log(`Watcher is ready and watching ${src}`);
    watcher.on('all', action);
  });

  return watcher;
}

module.exports = {
  watch,
};
