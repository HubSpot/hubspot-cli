# HubSpot CLI E2E tests

To assist in adding test coverage to the CLI, this project attempts to test `hs.*` commands as if they were being used by an end-user.

## Getting Started

The main test execution is kicked of via the `run-tests` script. `run-tests` itself is a CLI, so to see the available options, you can `run-tests --help`. This was done so that the tests can be installed against any given version of teh CLI and tested against it. In addition, it was done to keep the test logic separated from the CLI library

Note that if you are testing against a QA portal, not a PROD one, you'll need to add the `--qa` flag when running the script. There is still an outstanding issue with this because we attempt to add the `--qa` flag to all `hs` commands, however it is not available for all commands.

### Configuration

There are three ways to pass in necessary configuration to the script.

1. Through environment variables.

```bash
export PORTAL_ID="9289088"
export CLI_PATH="hs"
export PERSONAL_ACCESS_KEY="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
```

2. Through arguments on the `run-tests` script

```bash
run-tests --portalId=9289088
run-tests --cliPath=hs
run-tests --personalAccessKey="AiRiNGU2Y***************m1wLi2s8k2UlMYHEX"
```

3. If you need to override any environment variables at a test variable, you can do that via the `setLocalTestOverrides` function available in `env.js`

The priority is Local Test Overrides > CLI Arg Overrides > Environment Variables

### Running Locally

This repository should be added to the `hubspot-cli` repo, root folder, as a dependency. You can accomplish this locally by utilizing yarn linking.

1. In `hubspot-cli-tests`, `yarn link`
2. In `hubspot-cli`, `yarn link hubspot-cli-tests`
3. To run it, `cd hubspot-cli`, `./node_modules/hubspot-cli-tests/run-tests`

## Why Jasmine

You may be wondering why we are using Jasmine, and not Jest. The reason is because Jest does not provide an API for executing the tests within code. We need to do this since we are wrapping the tests within a CLI.

## Portals

A couple of portals have been set up specifically for testing. They are QA Portal 105786502 and Prod Portal 9289088. If you add any test data to the portals for testing, ensure you add it to the above two.

## To Do

- Only add `--qa` flag when needed to `hs` commands
- Bulk out test coverage
- Get some Github actions set up as part of the `@hubspot/cli` build to automatically run tests
- Sometimes the initial bootstrapping said the auth token is no longer valid, not too sure why this is. Investigate
