# CLI Command Acceptance Tests

Although we prefer to write workflow tests for our commands, it's sometimes beneficial to also include dedicated command tests. These tests are organized by command, and typically test the various permutations of inputs that the commands support.

**Common use cases for command tests:**
- There are many permutations of inputs that the command supports
- The workflows related to the command are not built or supported yet
- The command does not naturally fit into any common workflow
