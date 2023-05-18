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


## Testing
Ensure you are on the minimum version of Node supported by the CLI before running any tests, since that is the version of node that the build step uses. To find the minimum,
see the `engine` entry in the [cli package.json](./packages/cli/package.json).

Using [nvm](https://github.com/nvm-sh/nvm) to switch between versions will help speed up development.

Tests on the CLI are located in three places:
- `/acceptance-tests/tests`
- `/packages/cli/lib/__tests__`
- `/packages/cli-lib/lib/__tests__`

The acceptance tests are run using `yarn test-cli`. You will need to do some configuration before being able to run the acceptance tests. See the [acceptance-tests folder](./acceptance-tests/README.md) for more information.

The unit tests are run with `yarn test`. To run a specific test, use `yarn test [unit-test-name]`

Before attempting to merge, make sure you have run the following commands:
```bash
node -v # v10.24.1
yarn test
yarn test-cli
yarn check-deps # Should output "No dependency issues found"
```

## Merging
To merge, either create, or have a maintainer create a blank branch, and set your PRs base branch to the blank branch. Merge your PR into the blank branch, and ensure that it passes the build. Then merge the new branch into master.


## Documentation

- [Technical Design](./docs/TechnicalDesign.md)
- [Publishing Releases](./docs/PublishingReleases.md)
- [Debugging](./docs/Debugging.md)
