## Slack Integration Example

### Overview

This example shows you how to integrate with Slack, so you can add notifications when you take certain actions within HubSpot. In this example, we are uploading a folder to production, and then alerting Slack of the success. In the real world, this script would be invoked by a CI/CD platform such as Jenkins or GitHub.

### Running the Example

1. `npm install`
2. Configure your Slack instance for [incoming webhooks](https://api.slack.com/messaging/webhooks). See https://api.slack.com/messaging/webhooks for details
3. Open the `.env` file, and replace each environment variable with the appropriate information
4. `node index.js`

You should see a success message in your terminal as well as a message that has come into the Slack instance you configured

### Environment Variables

For this example, we are using the `dotenv` package to add some environment variables for testing. In the real world, we wouldn't want this, as uploading account ids and secrets to source control is a security flaw. Instead, you would want to have those variables stored securely on the CI/CD provider, such as Github Actions. In that scenario, you would access the variables directly through `process.env.MY_VARIABLE`, rather than relying on `dotenv`.

### Real Life Usage

An example flow would be:

1. You make local changes to MyProject
2. You push the changes to GitHub
3. You use GitHub Actions to run tests on your code
4. If tests fail, abort. No upload happens
5. If all tests pass, have the Github action invoke this script. The LOCAL_PROJECT_PATH would be set to the path it is accessed from on the Github action
6. The folder at LOCAL_PROJECT_PATH, is uploaded to your HubSpot DesignManager. Because we specified publish rather than draft, our changes are immediately published and available in your live HubSpot instance.
7. If the upload succeeds, we send an alert to Slack stating as much
