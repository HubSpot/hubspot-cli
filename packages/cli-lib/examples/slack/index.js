require('dotenv').config();
const { uploadFolder } = require('@hubspot/cli-lib/lib/uploadFolder');
const axios = require('axios');

const {
  PROJECT_ID,
  LOCAL_PROJECT_PATH,
  REMOTE_PROJECT_PATH,
  SLACK_ENDPOINT,
  ACCOUNT_ID,
} = process.env;

(async function() {
  const successMessage = `${PROJECT_ID} has been deployed to ${ACCOUNT_ID}`;

  try {
    // Upload the contents of LOCAL_PROJECT_PATH to REMOTE_PROJECT_PATH in Design Manager
    await uploadFolder(
      // Environment variables are passed in as strings, convert it to a number
      parseInt(ACCOUNT_ID, 10),
      LOCAL_PROJECT_PATH,
      REMOTE_PROJECT_PATH,
      'publish' // Valid options are 'draft' or 'publish'
    );
  } catch (e) {
    return axios.post(SLACK_ENDPOINT, {
      text: `${PROJECT_ID} encountered an error uploading ${LOCAL_PROJECT_PATH} to your ${ACCOUNT_ID} account\n${e.message}`,
    });
  }

  // Slack offers tons of customization with how the message appears
  // See https://api.slack.com/messaging/webhooks#advanced_message_formatting for details
  console.log(successMessage);
  await axios.post(SLACK_ENDPOINT, {
    text: successMessage,
  });
})();
