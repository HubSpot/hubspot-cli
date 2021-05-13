require('dotenv').config();
const { uploadFolder, Mode } = require('@hubspot/cli-lib');
const axios = require('axios');

const {
  LOCAL_PROJECT_PATH,
  REMOTE_PROJECT_PATH,
  SLACK_ENDPOINT,
  ACCOUNT_ID,
} = process.env;

(async function() {
  const successMessage = `${LOCAL_PROJECT_PATH} has been deployed to ${ACCOUNT_ID}`;

  try {
    // Upload the contents of LOCAL_PROJECT_PATH to REMOTE_PROJECT_PATH in Design Manager
    await uploadFolder(
      // Environment variables are passed in as strings, convert it to a number
      parseInt(ACCOUNT_ID, 10),
      LOCAL_PROJECT_PATH,
      REMOTE_PROJECT_PATH,
      Mode.publish
    );
  } catch (e) {
    return axios.post(SLACK_ENDPOINT, {
      text: `Encountered an error uploading ${LOCAL_PROJECT_PATH} to your ${ACCOUNT_ID} account\n${e.message}`,
    });
  }

  // Slack offers tons of customization with how the message appears
  // See https://api.slack.com/messaging/webhooks#advanced_message_formatting for details
  console.log(successMessage);
  await axios.post(SLACK_ENDPOINT, {
    text: successMessage,
  });
})();
