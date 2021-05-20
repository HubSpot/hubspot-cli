const { Mode, getAccountId, loadConfig } = require('@hubspot/cli-lib');
const { upload } = require('@hubspot/cli-lib/api/fileMapper');

// Mock out some environment variables
const LOCAL_FILE_PATH = './MyProject/README.md';
const REMOTE_FILE_PATH = '/MyProject/README.md';

// Loads the hubspot.config.yml file into memory for cli-lib usage
loadConfig();

/**
 *  getAccountId will get the default accountId specified in your hubspot.config.yml file
 *  You can alternatively pass in an account name if you don't want the default account
 *  to be used.
 */
const accountId = getAccountId();

(async function() {
  try {
    // Upload the contents of LOCAL_FILE_PATH to REMOTE_FILE_PATH in Design Manager
    await upload(accountId, LOCAL_FILE_PATH, REMOTE_FILE_PATH, Mode.publish);
    console.log(`${LOCAL_FILE_PATH} has been deployed to ${accountId}`);
  } catch (e) {
    console.error(
      `Encountered an error uploading ${LOCAL_FILE_PATH} to your ${accountId} account\n${e.message}`
    );
    process.exit(1);
  }
})();
