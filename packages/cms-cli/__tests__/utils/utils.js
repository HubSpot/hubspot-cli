const { renameSync } = require('fs');
const path = require('path');

const tolerantMove = (oldPath, newPath) => {
  try {
    renameSync(oldPath, newPath);
  } catch (e) {
    // Empty
  }
};

const HS_CONFIG_PATH = path.join(__dirname, './hubspot.config.yml');

module.exports = { tolerantMove, HS_CONFIG_PATH };
