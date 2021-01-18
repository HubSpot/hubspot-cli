const request = require('request-promise-native');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

// https://developer.github.com/v3/#user-agent-required
const USER_AGENT_HEADERS = { 'User-Agent': 'HubSpot/hubspot-cms-tools' };

/**
 * @param {String} repoName - name of the repository
 * @param {String} filePath - path where config file is stored
 */
async function fetchRawConfig(repoName, filePath) {
  const URI = `https://api.github.com/repos/HubSpot/${repoName}/contents/${filePath}`;
  try {
    return await request.get(URI, {
      headers: { ...USER_AGENT_HEADERS },
      json: true,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      logger.error(`Config file not found.`);
    }
  }
  return null;
}

/**
 * @param {String} filePath - path where config file is stored
 * @param {String} repoName - name of the github repository
 * @returns {Buffer|Null} Zip data buffer
 */
async function downloadConfig(repoName, filePath) {
  try {
    const configData = await fetchRawConfig(repoName, filePath);
    if (!configData) return;
    const { download_url: downloadUrl, name } = configData;
    logger.log(`Fetching ${name}...`);
    const config = await request.get(downloadUrl, {
      encoding: null,
      headers: { ...USER_AGENT_HEADERS },
    });
    logger.log('Finished downloading config file');
    return JSON.parse(config.toString());
  } catch (err) {
    logger.error('An error occured fetching the config file.');
    logErrorInstance(err);
  }
  return null;
}

module.exports = {
  downloadConfig,
};
