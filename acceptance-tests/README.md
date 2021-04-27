# HubSpot CLI Acceptance Tests

This project tests `hs.*` commands as if they were being used by an end-user.

## Getting Started

The main test execution is kicked off by running `yarn test-cli` from the root of `hubspot-cli`. This will run the `run-tests` scipe which itself is a CLI, so to see the available options, you can `run-tests --help`. This was done so that the tests can be installed against any given version of the CLI and tested against it. In addition, it was done to keep the test logic separated from the CLI library.

Note that if you are testing against a QA portal, not a PROD one, you'll need to add the `--qa` flag when running the script. There is still an outstanding issue with this because we attempt to add the `--qa` flag to all `hs` commands, however it is not available for all commands.

### Configuration

There are four ways to pass in necessary configuration to the script.

1. Creating a .env file in `acceptance-tests` folder.

```bash
PORTAL_ID="9289088"
CLI_PATH="hs"
PERSONAL_ACCESS_KEY="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
CLIENT_ID="123a4b56-****-****-****-************"
CLIENT_SECRET="ab12345c-****-****-****-************"
```

2. Through environment variables.

```bash
export PORTAL_ID="9289088"
export CLI_PATH="hs"
export PERSONAL_ACCESS_KEY="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
export CLIENT_ID="123a4b56-****-****-****-************"
export CLIENT_SECRET="ab12345c-****-****-****-************"
```

3. Through arguments on the `run-tests` script

```bash
run-tests --portalId=9289088 --cliPath=hs --personalAccessKey="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX" --clientId="123a4b56-****-****-****-************" --clientSecret="ab12345c-****-****-****-************"
```

4. If you need to override any environment variables at a test variable, you can do that via the `setLocalTestOverrides` function available in `env.js`

The priority is Local Test Overrides > CLI Arg Overrides > Environment Variables

### Running Locally

1. Run `lerna bootstrap` to install dependencies
1. Run `yarn test-cli`

## Why Jasmine

You may be wondering why we are using Jasmine, and not Jest. The reason is because Jest does not provide an API for executing the tests within code. We need to do this since we are wrapping the tests within a CLI.

## Accounts

A couple of account have been set up specifically for testing. They are QA Account 105786502 and Prod Account 9289088. If you add any test data to the accounts for testing, ensure you add it to the above two.

## Issues

The `.env` file does not get recognized when running [act](https://github.com/nektos/act) locally to run the tests within the github action. To bypass this, you can comment out the `.env` line in the `.gitignore` file and run `act again`. See https://github.com/nektos/act/issues/193 for more info.

## To Do

- Only add `--qa` flag when needed to `hs` commands
- Bulk out test coverage
- Sometimes the initial bootstrapping said the auth token is no longer valid, not too sure why this is. Investigate
