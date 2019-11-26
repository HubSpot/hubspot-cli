[lerna]: https://github.com/lerna/lerna
[from-package]: https://github.com/lerna/lerna/tree/master/commands/publish#bump-from-package

Publishing Releases
===================

We're using [lerna][lerna] to make managing multiple packages in the same repos easier.

Before releasing a new version, it is a good idea to release a prerelease so that folks can test out the changes.

## Setting up NPM user access
1. Run `npm login` and login using credentials from npmjs.com

## Publishing a new version
1. Run `yarn publish-release`. The publish command will handle bumping the version, tagging via git, and publishing the packages to NPM.
2. If there are publishing errors, you can run again via `yarn lerna publish from-package` ([Docs][from-package]).

## Publishing a prerelease
1. Run `yarn publish-prerelease`. The publish command will handle bumping the version, tagging via git, and publishing the packages to NPM under the `next` dist-tag.
2. If there are publishing errors, you can run again via `yarn lerna publish from-package --dist-tag next` ([Docs][from-package]).

