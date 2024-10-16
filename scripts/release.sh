#!/bin/bash

version_increment=""
tag=""
error=false

current_version=$(node -p -e "require('./package.json').version")

# Formatting
bold=$(tput bold)
normal=$(tput sgr0)

usage() {
  echo "Usage"
  echo "yarn release --version=<major|minor|patch> --tag=<latest|next|experimental>"
  echo
  echo "Options:"
  echo " -v, --version   Type of version to release   <major|minor|patch>"
  echo " -t, --tag       Release tag                  <latest|next|experimental>"
  echo
  echo "Note: you must be on the main branch to create a new release."
}

check_main() {
  branch=$(git rev-parse --abbrev-ref HEAD)

  if [ "$branch" != "main" ]; then
    echo 'Error: New release can only be published on main branch'

    exit 1
  fi
}

handle_options() {
  for i in "$@"; do
    case $i in
      -h|--help)
        usage
        exit 0
        ;;
      -v=*|--version=*)
        version_increment="${i#*=}"
        shift
        ;;
      -t=*|--tag=*)
        tag="${i#*=}"
        shift
        ;;
      *)
        echo "Invalid option: $1" >&2
        usage
        exit 1
        ;;
    esac
  done
}

validate_options() {
  if [ "$version_increment" = "" ]; then
    echo "Error: no version specified"
    error=true
  elif ! { [ "$version_increment" = "major" ] || [ "$version_increment" = "minor" ] || [ "$version_increment" = "patch" ]; }; then
    echo "Error: invalid version specified"
    error=true
  fi

  if [ "$tag" = "" ]; then
    echo "Error: no tag specified"
    error=true
  elif ! { [ "$tag" = "latest" ] || [ "$tag" = "next" ] || [ "$tag" = "experimental" ]; }; then
    echo "Error: invalid tag specified"
    error=true
  fi

  if [ "$error" = true ]; then
    echo
    usage
    exit 1
  fi
}

confirmation_prompt() {
  echo "Current version: $current_version"
  echo "Next version: $next_version"
  read -p "Release new ${bold}$version_increment${normal} version of the CLI on tag ${bold}$tag${normal}? (y/N) " -r
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    [[ "$0" = "$BASH_SOURCE" ]] && exit 1 || return 1
  fi

  echo
}

handle_options "$@"
check_main
validate_options

# The $prefix var is used to add the string "pre" to the $version_increment
# This is used to tell `yarn version` to do a prerelease version increment rather than a standard increment
# See https://classic.yarnpkg.com/lang/en/docs/cli/version/#toc-yarn-version-premajor
# If $tag isn't "latest", the next release will be a prerelease, so set $prefix to "pre"
[[ "$tag" = "latest" ]] && prefix="" || prefix="pre"

# preid is the string identifier used in prerelease tags
# For example, in v1.0.0-beta.0, the preid is "beta"
# This sets the proper preid based on the tag. For non prereleases, preid is ignored
[[ "$tag" = "experimental" ]] && preid="experimental" || preid="beta"

# Get the next version so we can display it before the user confirms the release
next_version=$(yarn --silent semver $current_version -i $prefix$version_increment --preid $preid)

confirmation_prompt

yarn version --$prefix$version_increment --preid=$preid
yarn build
cd dist
npm publish --tag "$tag"
git push --atomic origin main v$next_version




