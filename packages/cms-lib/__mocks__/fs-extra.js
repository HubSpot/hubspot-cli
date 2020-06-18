const { MODULE_EXTENSION } = require('../lib/constants');
const { getExt } = require('../path');

const fs = jest.genMockFromModule('fs-extra');

fs.stat = async function stat(filepath, callback) {
  const ext = getExt(filepath);
  const isFile = () => {
    return !!ext && ext !== MODULE_EXTENSION;
  };
  const _stat = {
    isFile,
    isDirectory() {
      return !isFile();
    },
  };
  if (callback) {
    callback(_stat);
  }
  return _stat;
};

let mockedReadFile = '';
let mockedExistsValue = false;

fs.__setReadFile = newValue => (mockedReadFile = newValue);
fs.__setExistsValue = newValue => (mockedExistsValue = newValue);

fs.readFileSync = () => mockedReadFile;
fs.existsSync = () => mockedExistsValue;
fs.writeFileSync = () => true;
fs.unlinkSync = () => true;
fs.outputFile = jest.fn(data => data);

module.exports = fs;
