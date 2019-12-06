const API_KEY_REGEX = /^([a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12})$/i;

const CAPITAL_LETTER_REGEX = /(?=[A-Z])/;

module.exports = {
  API_KEY_REGEX,
  CAPITAL_LETTER_REGEX,
};
