const themeConfigValidator = require('./marketplaceValidators/theme/themeConfigValidator');
const templateLimitValidator = require('./marketplaceValidators/theme/templateLimitValidator');

// TODO add validators
const HUBSPOT_VALIDATORS = {
  theme: [],
};

const MARKETPLACE_VALIDATORS = {
  theme: [
    ...HUBSPOT_VALIDATORS.theme,
    themeConfigValidator,
    templateLimitValidator,
  ],
};

module.exports = {
  hubspotValidators: HUBSPOT_VALIDATORS,
  marketplaceValidators: MARKETPLACE_VALIDATORS,
};
