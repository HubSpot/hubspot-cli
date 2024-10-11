# CLI Command Acceptance Tests

These tests give us the opportunity to increase the test coverage for each command. These tests are organized by command, and typically test the various permutations of inputs that each command supports. It's likely that some commands will be tested in workflows and also in isolation. These tests should not rely on any specific configuration within the target HubSpot account. All of these tests must assume that they are running against a brand new HubSpot account with no pre-populated assets. Commands that rely on pre-populated assets should be tested within workflows.

**Common use cases for command tests:**
- There are many permutations of inputs that the command supports
- The workflows related to the command are not built or supported yet
- The command does not naturally fit into any common workflow
- The command does not rely on pre-populated assets within the target HubSpot account
