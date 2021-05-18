require('dotenv').config();
const {
  uploadFolder,
  Mode,
  getAccountId,
  loadConfig,
} = require('@hubspot/cli-lib');
const axios = require('axios');

const { LOCAL_PROJECT_PATH, REMOTE_PROJECT_PATH, SLACK_ENDPOINT } = process.env;

(async function() {
  // Loads the hubspot.config.yml file into memory for cli-lib usage
  loadConfig();

  /**
   *  getAccountId will get the default accountId specified in your hubspot.config.yml file
   *  You can alternatively pass in an account name if you don't want the default account
   *  to be used.
   */
  const accountId = getAccountId();

  const successMessage = `${LOCAL_PROJECT_PATH} has been deployed to ${accountId}`;
  try {
    // Upload the contents of LOCAL_PROJECT_PATH to REMOTE_PROJECT_PATH in Design Manager
    await uploadFolder(
      // Environment variables are passed in as strings, convert it to a number
      parseInt(accountId, 10),
      LOCAL_PROJECT_PATH,
      REMOTE_PROJECT_PATH,
      Mode.publish
    );
  } catch (e) {
    return axios.post(SLACK_ENDPOINT, {
      text: `Encountered an error uploading ${LOCAL_PROJECT_PATH} to your ${accountId} account\n${e.message}`,
    });
  }

  // Slack offers tons of customization with how the message appears
  // See https://api.slack.com/messaging/webhooks#advanced_message_formatting for details
  console.log(successMessage);
  await axios.post(SLACK_ENDPOINT, {
    text: successMessage,
  });
})();
