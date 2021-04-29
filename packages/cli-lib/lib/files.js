const findup = require('findup-sync');

const getThemeJSONPath = path =>
  findup('theme.json', {
    cwd: path,
    nocase: true,
  });

module.exports = { getThemeJSONPath };
