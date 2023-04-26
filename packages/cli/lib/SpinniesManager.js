const Spinnies = require('spinnies');

// Allows us to maintain a single instance of spinnies across multiple files
class SpinniesManager {
  constructor() {
    this.spinnies = null;
    this.parentKey = null;
  }

  init(options) {
    if (!this.spinnies) {
      this.spinnies = new Spinnies(options);
    }

    return {
      add: this.add.bind(this),
      pick: this.spinnies.pick.bind(this.spinnies),
      remove: this.remove.bind(this),
      removeAll: this.removeAll.bind(this),
      update: this.spinnies.update.bind(this.spinnies),
      succeed: this.spinnies.succeed.bind(this.spinnies),
      fail: this.spinnies.fail.bind(this.spinnies),
      stopAll: this.spinnies.stopAll.bind(this.spinnies),
      hasActiveSpinners: this.spinnies.hasActiveSpinners.bind(this.spinnies),
    };
  }

  add(key, options = {}) {
    const { isParent, noIndent, ...rest } = options;
    const originalIndent = rest.indent || 0;

    this.spinnies.add(key, {
      ...rest,
      indent: this.parentKey && !noIndent ? originalIndent + 1 : originalIndent,
    });

    if (isParent) {
      this.parentKey = key;
    }
  }

  remove(key) {
    if (this.spinnies) {
      if (key === this.parentKey) {
        this.parentKey = null;
      }
      this.spinnies.remove(key);
    }
  }

  removeAll(allowedKeys = []) {
    if (this.spinnies) {
      Object.keys(this.spinnies.spinners).forEach(key => {
        if (!allowedKeys.includes(key)) {
          this.remove(key);
        }
      });
    }
  }
}

module.exports = new SpinniesManager();
