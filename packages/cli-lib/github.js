const axios = require('axios');
const { logger } = require('./logger');
const { logErrorInstance } = require('./errorHandlers');
const { DEFAULT_USER_AGENT_HEADERS } = require('./http/requestOptions');

/**
 * @param {String} filePath - path where config file is stored
 * @param {String} repoName - name of the github repository
 * @returns {Buffer|Null} Zip data buffer
 */
async function fetchJsonFromRepository(repoName, filePath) {
  try {
    const URI = `https://raw.githubusercontent.com/HubSpot/${repoName}/${filePath}`;
    logger.debug(`Fetching ${URI}...`);

    return axios.get(URI, {
      json: true,
      headers: { ...DEFAULT_USER_AGENT_HEADERS },
    });
  } catch (err) {
    logger.error('An error occured fetching JSON file.');
    logErrorInstance(err);
  }
  return null;
}

module.exports = {
  fetchJsonFromRepository,
};
