var { renameSync } = require('fs');

const tolerantMove = (oldPath, newPath) => {
  try {
    renameSync(oldPath, newPath);
  } catch (e) {
    // Empty
  }
};

module.exports = { tolerantMove };
