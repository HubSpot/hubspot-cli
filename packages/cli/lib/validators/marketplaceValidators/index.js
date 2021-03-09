const themeConfigValidator = require('./themeConfigValidator');
const templateLimitValidator = require('./templateLimitValidator');

const HUBSPOT_VALIDATORS = [];
const MARKETPLACE_VALIDATORS = [
  ...HUBSPOT_VALIDATORS,
  themeConfigValidator,
  templateLimitValidator,
];

module.exports = {
  hubspotValidators: HUBSPOT_VALIDATORS,
  marketplaceValidators: MARKETPLACE_VALIDATORS,
};
