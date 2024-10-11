# CLI Workflow Acceptance Tests

These tests are intended to mimic real developer workflows. Whenever possible we should prioritize writing workflows for new commands, or adding tests for new commands into existing workflows. Testing real CLI use-cases is more valuable to us than testing individual commands in isolation.

Another benefit of workflow tests is that they enable us to run the tests against new HubSpot accounts without requiring us to pre-configure each account.

**An example workflow looks something like this:**
1. Create an asset locally using a CLI command
2. Upload that asset into the target HubSpot account
3. Run commands that interact with the asset within HubSpot (like list or move)
4. Finally, make sure to delete the asset from the target HubSpot account
