# Contributing
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

* To test a command when `@hubspot/cms-cli` is a dependency in another package like `cms-theme-boilerplate`.

In order to test changes in another npm package that is using `@hubspot/cms-cli`, [yarn link](https://yarnpkg.com/lang/en/docs/cli/link/) can be used.

```bash
cd /path/to/other-npm-package
yarn link @hubspot/cms-cli
```

## Documentation

- [Technical Design](./docs/TechnicalDesign.md)
- [Publishing Releases](./docs/PublishingReleases.md)
- [Debugging](./docs/Debugging.md)
