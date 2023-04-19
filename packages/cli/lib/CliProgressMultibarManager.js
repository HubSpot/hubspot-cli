const cliProgress = require('cli-progress');

class CliProgressMultibarManager {
  constructor() {
    this.multibar = null;
    this.barInstances = {};
  }

  init(options) {
    if (!this.multibar) {
      this.multibar = new cliProgress.MultiBar(
        {
          hideCursor: true,
          format: '[{bar}] {percentage}% | {label}',
          gracefulExit: true,
          ...options,
        },
        cliProgress.Presets.rect
      );
    }

    return {
      get: this.get.bind(this),
      create: this.create.bind(this),
      update: this.update.bind(this),
      increment: this.increment.bind(this),
      remove: this.multibar.remove.bind(this.multibar),
      stop: this.multibar.stop.bind(this.multibar),
      log: this.multibar.log.bind(this.multibar),
    };
  }

  get(barName) {
    return this.barInstances[barName];
  }

  create(barName, total = 100, startValue = 0, options = {}) {
    if (!this.multibar) {
      return;
    }
    if (!this.barInstances[barName]) {
      this.barInstances[barName] = this.multibar.create(
        total,
        startValue,
        options
      );
    }
  }

  update(barName, value, options = {}) {
    const barInstance = this.barInstances[barName];
    if (barInstance) {
      barInstance.update(value, options);
    }
  }

  increment(barName, value, options = {}) {
    const barInstance = this.barInstances[barName];
    if (barInstance) {
      barInstance.increment(value, options);
    }
  }
}

module.exports = new CliProgressMultibarManager();
