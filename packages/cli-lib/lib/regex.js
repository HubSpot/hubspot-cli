const API_KEY_REGEX = /^([a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12})$/i;
const FUNCTION_FOLDER_REGEX = /\w*.functions/;
const STRING_WITH_NO_SPACES_REGEX = /^\S*$/;

module.exports = {
  API_KEY_REGEX,
  FUNCTION_FOLDER_REGEX,
  STRING_WITH_NO_SPACES_REGEX,
};
