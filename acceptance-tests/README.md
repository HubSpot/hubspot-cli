# HubSpot CLI Acceptance Tests

This project tests our CLI's `hs <*>` commands as if they were being used by an end-user.

## Getting Started

The main test execution is kicked off by running `yarn test-cli` from the root of `hubspot-cli`. This will run the `run-tests` scipt which itself is a CLI, so to see the available options, you can `run-tests --help`. This was done so that the tests can be installed against any given version of the CLI and tested against it. In addition, it was done to keep the test logic separated from the CLI library.

Note that if you are testing against a QA portal, not a PROD one, you'll need to add the `--qa` flag when running the script. There is still an outstanding issue with this because we attempt to add the `--qa` flag to all `hs` commands, however it is not available for all commands.

### Setup

To setup these tests, first [create an app](https://developers.hubspot.com/docs/api/creating-an-app) in a [HubSpot developer account](https://app.hubspot.com/signup-hubspot/crm). Under the "Auth" tab, give your app at least one scope, and set the redirect URL to `localhost:3000/oauth-callback`, and save your changes. Also, take note of your Client ID, and Client Secret and click "Copy full URL". ![image](https://user-images.githubusercontent.com/48874841/175648758-b2fdb491-90f8-4573-ad9e-af7e1236548c.png)

Next, in the navigation bar, click "Testing", and then "Create app test account". Then, paste the OAuth URL you copied earlier into your browser, choose your newly created test account, and click "Connect App".

Now, navigate back to the "Testing" page, and click your test account. Take note of the Account ID in the URL (`https://app.hubspot.com/dashboard-library/ACCOUNT_ID`). Then [navigate to the following page and generate a personal access key](https://app.hubspot.com/portal-recommend/l?slug=personal-access-key) that is associated with your test account.

Generate [a github token](https://github.com/settings/tokens/new) to test with. This is required for the CLI commands that interact with the github api.

You now have all the information required to create a `.env` file in the [Configuration](./README.md#configuration) section.

Finally, you must add an asset to your new test account. To do this, navigate to the [HubSpot marketplace](https://ecosystem.hubspot.com/marketplace/website/free-cms-accelerator-themes), log into your test account, and install an asset.

### Configuration

There are three ways to pass in necessary configuration to the script.

1. Creating a `.env` file in `acceptance-tests` folder.

```bash
ACCOUNT_ID="123456789"
CLI_PATH="hs"
PERSONAL_ACCESS_KEY="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
GITHUB_TOKEN="123a4b56-****-****-****-************"
```

2. Through environment variables.

```bash

export ACCOUNT_ID="123456789"
export CLI_PATH="hs"
export PERSONAL_ACCESS_KEY="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
export GITHUB_TOKEN="123a4b56-****-****-****-************"
```

3. Through arguments on the `run-tests` script

```bash
run-tests --accountId=123456789 --cliPath=hs --personalAccessKey="*********" --githubToken="********"
```

### Running Locally

1. Run `lerna bootstrap` to install dependencies
2. Run `yarn test-cli` from the root of the CLI repo

## Why Jasmine

You may be wondering why we are using Jasmine, and not Jest. The reason is because Jest does not provide an API for executing the tests within code. We need to do this since we are wrapping the tests within a CLI.

## Accounts

A couple of accounts have been set up specifically for testing. They are QA Account 105786502 and Prod Account 9289088. If you add any test data to the accounts for testing, ensure you add it to the above two.

## Issues

The `.env` file does not get recognized when running [act](https://github.com/nektos/act) locally to run the tests within the github action. To bypass this, you can comment out the `.env` line in the `.gitignore` file and run `act again`. See https://github.com/nektos/act/issues/193 for more info.

## Gotchas

- Currently sometimes the personal-access-key test is flakey. Run the tests again and it should pass.

- The tests seem to trip up on usages of the `ora` library. To get around this, we have a list of blacklisted strings. If your test is being picky about ora, add the error message to the blacklist in `cmd.js`
