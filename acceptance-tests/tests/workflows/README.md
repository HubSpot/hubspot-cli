# CLI Workflow Acceptance Tests

These tests are intended to mimic real developer workflows. Whenever possible we should write workflows tests for new commands. Testing real CLI use-cases is an effective way for us to catch impactful bugs before releases. These workflow tests enable testing on new HubSpot accounts without requiring any pre-configuration of the accounts. This is useful for testing commands that rely on certain assets existing within the target HubSpot account.

**An example workflow looks something like this:**
1. Create an asset locally using a CLI command
2. Upload that asset into the target HubSpot account
3. Run commands that interact with the asset within HubSpot (like list or move)
4. Finally, make sure to delete the asset from the target HubSpot account
