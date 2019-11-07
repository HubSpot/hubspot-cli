const path = require('path');

const walk = jest.genMockFromModule('../walk');

/*
 * File results mocked in pattern of:
 *  "<resolved>/boilerplate/modules/My Footer.module/fields.json"
 * A request for the "boilerplate" dir will work.
 * Other requests will error.
 */

const testDir = 'boilerplate';
const testFiles = [
  'fields.json',
  'meta.json',
  'module.css',
  'module.html',
  'module.js',
].map(name => path.join('modules', 'My Footer.module', name));

walk.walk = dir => {
  const requestDir = path.resolve(dir);
  const boilerplateDir = path.resolve(testDir);
  if (requestDir !== boilerplateDir) {
    return Promise.reject(
      new Error(`ENOENT: no such file or directory, scandir '${requestDir}'`)
    );
  }
  return Promise.resolve(
    testFiles.map(file => path.join(boilerplateDir, file))
  );
};

module.exports = walk;
