# HubSpot CLI Acceptance Tests

This project tests our CLI's `hs <*>` commands as if they were being used by an end-user.

## Getting Started

The main test execution is kicked off by running `yarn test-cli` from the root of `hubspot-cli`. This will run the test suites defined in the `tests` directory.

Note that if you are testing against a QA portal, not a PROD one, you'll need to run `yarn test-qa`. There is still an outstanding issue with this because we attempt to add the `--qa` flag to all `hs` commands, however it is not available for all commands.

### Setup

To setup these tests, there are two required arguments and one optional one:

1. The ID of a HubSpot account that you are a user in
2. Your generated personal access key in that account (available in [personal access key ui](https://app.hubspot.com/l/personal-access-key))
3. [Optional] A path to an instance of the CLI. The test runner will execute the commands against this provided instance
   - The default behavior is to use `../bin/hs`

### Configuration

There are 2 ways to pass in necessary configuration to the script.

1. Creating a `.env` file in `acceptance-tests` folder.

```bash
ACCOUNT_ID="123456789"
PERSONAL_ACCESS_KEY="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
CLI_PATH="hs"
```

2. Through environment variables.

```bash
export ACCOUNT_ID="123456789"
export PERSONAL_ACCESS_KEY="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
export CLI_PATH="hs"
```

### Running Locally

1. Run `yarn` to install dependencies
2. Run `yarn test-cli` from the root of the CLI repo

**NOTE:** Include the `--debug` flag for more verbose output


## Accounts

A couple of accounts have been set up specifically for testing. They are QA Account 105786502 and Prod Account 9289088. If you add any test data to the accounts for testing, ensure you add it to the above two.

## Issues

The `.env` file does not get recognized when running [act](https://github.com/nektos/act) locally to run the tests within the github action. To bypass this, you can comment out the `.env` line in the `.gitignore` file and run `act again`. See https://github.com/nektos/act/issues/193 for more info.
