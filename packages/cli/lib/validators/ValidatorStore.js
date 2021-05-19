const { isModuleFolderChild } = require('@hubspot/cli-lib/modules');

const UNIQUE_MODULES_KEY = 'uniqueModules';

// Global store to be utilized by the validators
class ValidatorStore {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  setValue(key, value) {
    this.store[key] = value;
  }

  hasValue(key) {
    return typeof this.store[key] !== 'undefined';
  }

  getValue(key) {
    return this.store[key];
  }

  getUniqueModulesFromFiles(files) {
    if (!this.hasValue(UNIQUE_MODULES_KEY)) {
      const uniqueModules = {};

      files.forEach(file => {
        if (isModuleFolderChild({ isLocal: true, path: file })) {
          // Get unique module path by removing the file name
          const lastSlashIndex = file.lastIndexOf('/');
          const modulePath = file.slice(0, lastSlashIndex);
          if (!uniqueModules[modulePath]) {
            uniqueModules[modulePath] = {};
          }
          const fileName = file.slice(lastSlashIndex + 1, file.length);
          uniqueModules[modulePath][fileName] = file;
        }
      });
      this.setValue(UNIQUE_MODULES_KEY, uniqueModules);
    }

    return this.getValue(UNIQUE_MODULES_KEY);
  }
}

module.exports = new ValidatorStore();
