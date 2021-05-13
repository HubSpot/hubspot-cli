const { Mode } = require('@hubspot/cli-lib');
const { upload } = require('@hubspot/cli-lib/api/fileMapper');

// Mock out some environment variables
const ACCOUNT_ID = undefined; // Should be your HubSpot portal/account ID, as a number
const LOCAL_FILE_PATH = './MyProject/README.md';
const REMOTE_FILE_PATH = '/MyProject/README.md';

(async function() {
  try {
    // Upload the contents of LOCAL_FILE_PATH to REMOTE_FILE_PATH in Design Manager
    await upload(ACCOUNT_ID, LOCAL_FILE_PATH, REMOTE_FILE_PATH, Mode.publish);
    ` has been deployed to ${ACCOUNT_ID}`;
  } catch (e) {
    console.error(
      `Encountered an error uploading ${LOCAL_FILE_PATH} to your ${ACCOUNT_ID} account\n${e.message}`
    );
    process.exit(1);
  }
})();
