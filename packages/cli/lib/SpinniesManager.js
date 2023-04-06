const Spinnies = require('spinnies');

// Allows us to maintain a single instance of spinnies across multiple files
class SpinniesManager {
  constructor() {
    this.spinnies = null;
    this.indentNext = false;
  }

  init(options) {
    if (!this.spinnies) {
      this.spinnies = new Spinnies(options);
    }

    return {
      add: this.add.bind(this),
      pick: this.spinnies.pick.bind(this.spinnies),
      remove: this.spinnies.remove.bind(this.spinnies),
      update: this.spinnies.update.bind(this.spinnies),
      succeed: this.spinnies.succeed.bind(this.spinnies),
      fail: this.spinnies.fail.bind(this.spinnies),
      stopAll: this.spinnies.stopAll.bind(this.spinnies),
      hasActiveSpinners: this.spinnies.hasActiveSpinners.bind(this.spinnies),
    };
  }

  add(key, options = {}) {
    const { isParent, ...rest } = options;
    const originalIndent = rest.indent || 0;

    this.spinnies.add(key, {
      ...rest,
      indent: this.indentNext ? originalIndent + 1 : originalIndent,
    });

    if (isParent) {
      this.indentNext = true;
    }
  }
}

module.exports = new SpinniesManager();
