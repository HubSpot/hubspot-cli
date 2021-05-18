## File Upload Example

** This example is for uploading a file to design-manager. To see an example on how to upload assets to File Manager, check out the filemanager-upload example **

### Overview

This example should you a simple file upload scenario. This would be used to upload a single file. To see how to upload a whole folder, check out the `slack` example.

### Running the Example

1. `npm install`
2. Open index.js, replace each ACCOUNT_ID with the account id of your HubSpot account. Note that in a production environment, data like this should be stored securely as an environment variable.
3. `node index.js`

You should see a success message in your terminal

### Real Life Usage

An example flow would be:

1. You make local changes to MyProject
2. You push the changes to GitHub
3. You use GitHub Actions to run tests on your code
4. If tests fail, abort. No upload happens
5. If all tests pass, have the Github action invoke this script. The LOCAL_PROJECT_PATH would be set to the path it is accessed from on the Github action. The mocked out environment variables we have in index.js would instead be securely stored on Github Actions and referenced through process.env.MY_VARIABLE
6. The folder at LOCAL_PROJECT_PATH is uploaded to your HubSpot DesignManager. Because we specified publish rather than draft, our changes are immediately published and available in your live HubSpot instance.
7. If the upload succeeds, log out a success message to the terminal
