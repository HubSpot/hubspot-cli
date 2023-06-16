const Spinnies = require('spinnies');

// Allows us to maintain a single instance of spinnies across multiple files
class SpinniesManager {
  constructor() {
    this.spinnies = null;
    this.parentKey = null;
    this.categories = {};
  }

  init(options) {
    if (!this.spinnies) {
      this.spinnies = new Spinnies(options);
    }

    return {
      add: this.add.bind(this),
      addOrUpdate: this.addOrUpdate.bind(this),
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

  addKeyToCategory(key, category) {
    if (!this.categories[category]) {
      this.categories[category] = [];
    }
    this.categories[category].push(key);
  }

  getCategoryForKey(key) {
    return Object.keys(this.categories).find(category =>
      this.categories[category].find(k => k === key)
    );
  }

  removeKeyFromCategory(key) {
    const category = this.getCategoryForKey(key);
    if (category) {
      const index = this.categories[category].indexOf(key);
      this.categories[category].splice(index, 1);
    }
  }

  add(key, options = {}) {
    const { category, isParent, noIndent, ...rest } = options;
    const originalIndent = rest.indent || 0;

    // Support adding generic spinnies lines without specifying a key
    const uniqueKey = key || `${Date.now()}-${Math.random()}`;

    if (category) {
      this.addKeyToCategory(uniqueKey, category);
    }

    this.spinnies.add(uniqueKey, {
      ...rest,
      indent: this.parentKey && !noIndent ? originalIndent + 1 : originalIndent,
    });

    if (isParent) {
      this.parentKey = uniqueKey;
    }

    return uniqueKey;
  }

  // TODO there is an issue here with the usage of "non-spinnable"
  // The spinnies lib automatically removes any non-active spinners,
  // so "pick" is telling us that these spinners don't exist
  // https://github.com/jbcarpanelli/spinnies/blob/master/index.js#L186
  addOrUpdate(key, options = {}) {
    const spinner = this.spinnies.pick(key);

    if (spinner) {
      this.spinnies.update(key, options);
    } else {
      this.add(key, options);
    }
  }

  remove(key) {
    if (this.spinnies) {
      if (key === this.parentKey) {
        this.parentKey = null;
      }
      this.removeKeyFromCategory(key);
      this.spinnies.remove(key);
    }
  }

  /**
   * Removes all spinnies instances
   * @param {string} preserveCategory - do not remove spinnies with a matching category
   */
  removeAll({ preserveCategory = null, targetCategory = null } = {}) {
    if (this.spinnies) {
      Object.keys(this.spinnies.spinners).forEach(key => {
        if (targetCategory) {
          if (this.getCategoryForKey(key) === targetCategory) {
            this.remove(key);
          }
        } else if (
          !preserveCategory ||
          this.getCategoryForKey(key) !== preserveCategory
        ) {
          this.remove(key);
        }
      });
    }
  }
}

module.exports = new SpinniesManager();
