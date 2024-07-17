# Contributing
To contribute, fork this repository and create a new branch. Then create a PR. For more detailed instructions, see this [link](https://www.dataschool.io/how-to-contribute-on-github/).

## Setup

* Install the dependencies

```bash
yarn
```

* Bootstrap `lerna`

In order to manage multiple npm packages in the same Github repos, we use [lerna](https://lerna.js.org/).

```bash
yarn lerna bootstrap
````

* To test a command

First, you will need to create a config for the accounts that you want to be able to test using.

Once the config is created, commands can be run by providing a path to the executable file:

```
yarn hs upload --account [src] [dest]`
```

* To test a command when `@hubspot/cli` is a dependency in another package like `cms-theme-boilerplate`.

In order to test changes in another npm package that is using `@hubspot/cli`, [yarn link](https://yarnpkg.com/lang/en/docs/cli/link/) can be used.

```bash
cd /path/to/other-npm-package
yarn link @hubspot/cli
```

## Local development with local-dev-lib
When contributing to hubspot-cli, you may also need to make changes to cli-local-dev-lib. To use a local version of local-dev-lib as a dependancy, use [yarn link](https://classic.yarnpkg.com/lang/en/docs/cli/link/).
1. Run `yarn local-dev` in `local-dev-lib`
2. Run `yarn link @hubspot/local-dev-lib` in the hubspot-cli root and again in `packages/cli` to use the symlinked local package.

To stop using your local `local-dev-lib`, you can follow a similar process with [yarn unlink](https://classic.yarnpkg.com/en/docs/cli/unlink).

## Testing
Ensure you are on the minimum version of Node supported by the CLI before running any tests, since that is the version of node that the build step uses. To find the minimum,
see the `engine` entry in the [cli package.json](./packages/cli/package.json).

Using [nvm](https://github.com/nvm-sh/nvm) to switch between versions will help speed up development.

Tests on the CLI are located in two places:
- `/acceptance-tests/tests`
- `/packages/cli/lib/__tests__`

The acceptance tests are run using `yarn test-cli`. You will need to do some configuration before being able to run the acceptance tests. See the [acceptance-tests folder](./acceptance-tests/README.md) for more information.

The unit tests are run with `yarn test`. To run a specific test, use `yarn test [unit-test-name]`

Before attempting to merge, make sure you have run the following commands:
```bash
node -v # v10.24.1
yarn test
yarn test-cli
yarn check-deps # Should output "No dependency issues found"
```

### Testing with Docker
We use [Rancher Desktop](https://rancherdesktop.io/) to work with Docker containers. Install via the links on their homepage or with homebrew by running `brew install --cask rancher`.

When launching Rancher Desktop for the first time, you will need to:
- DISABLE the `kubernetes` checkbox
- Select `dockerd` as the container runtime
- Select `Manual` for configure path

Then, you will need to manually add this line to your shell's configuration file (i.e. `~/.bash_profile` or `~/.zshrc`):
```bash
export PATH=${PATH}:~/.rd/bin
```

Then you should have access to the `docker` CLI command (as long as Rancher Desktop is running).

To execute the CLI tests in a docker container, run:
```bash
yarn run-docker
```

This will do several things:
1. It will generate a new hs-cli-image docker image, copy project files into it, and install dependencies
2. It will then run a container and execute our test scripts inside of it
3. The container will remove itself after the run completes

## Merging
To merge, either create, or have a maintainer create a blank branch, and set your PRs base branch to the blank branch. Merge your PR into the blank branch, and ensure that it passes the build. Then merge the new branch into main.

## Documentation

- [Technical Design](./docs/TechnicalDesign.md)
- [Publishing Releases](./docs/PublishingReleases.md)
- [Debugging](./docs/Debugging.md)

## Debugging tips

### `yarn` links
Here are a couple of aliases that are helpful with debugging `yarn` links

```shell
alias view-installed-links="( ls -l node_modules ; ls -l node_modules/@* ) | grep ^l"
alias view-yarn-links="tree ~/.config/yarn/link"
```

`view-installed-links` will show symbolic links in the `node_modules` directory of the cwd.  So if you ran `yarn link package-name`,
you can use this to make certain the linking process was successful.

`view-yarn-links` will show the packages that have links setup in `yarn`.  So if you ran `yarn link` in `package-name` you
can use this to make certain it is set up and pointing to the correct directory.  This relies on the `tree` command being installed.

If you don't have `tree` available an alternate command is `alias view-yarn-links="ls -R -l ~/.config/yarn/link"`

### Using the node debugger
If you find yourself in a situation where you would like to step through the code in this project line by line in the debugger,
you can edit `packages/cli/bin/hs` and add either `--inspect` or `--inspect-brk` to the end of the hashbang like so:
`#!/usr/bin/env node {all the other arguments} --inspect`.  The two function similarly, with the main difference being that `--inspect-brk`
waits for the debugger to attach before beginning execution.

Once that is done, you should see something like this:

```shell
➜ yarn hs project dev
yarn run v1.22.19
$ /Users/me/src/hubspot-cli/node_modules/.bin/hs project dev
Debugger listening on ws://127.0.0.1:9229/6ac9241f-419c-495e-9b5e-310391f7b36c
For help, see: https://nodejs.org/en/docs/inspector
```

You can then open your [inspector of choice](https://nodejs.org/en/learn/getting-started/debugging#inspector-clients) and
walk through the code
