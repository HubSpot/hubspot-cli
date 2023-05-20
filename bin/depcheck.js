const path = require('node:path');
const fs = require('node:fs');
const depcheck = require('depcheck');

const PACKAGES_PATH = path.resolve(__dirname, '../packages');
const DEP_CHECK_OPTIONS = {
  ignoreBinPackage: false, // ignore the packages with bin entry
  skipMissing: false, // skip calculation of missing dependencies
  ignorePatterns: [],
  ignoreMatches: [],
  parsers: {
    '**/*.js': depcheck.parser.es6,
  },
  detectors: [
    // the target detectors
    depcheck.detector.requireCallExpression,
    depcheck.detector.importDeclaration,
  ],
  specials: [],
};

async function processPackages() {
  let hasIssues = false;
  const filePaths = fs.readdirSync(PACKAGES_PATH);

  for (const filepath of filePaths) {
    const fullpath = path.join(PACKAGES_PATH, filepath);
    const stats = fs.statSync(fullpath);
    if (stats.isDirectory()) {
      console.log(`Checking for dependency issues with "${filepath}"...`);
      const depIssues = await depcheck(fullpath, DEP_CHECK_OPTIONS);

      if (Object.keys(depIssues.missing).length > 0) {
        console.log(`The package at "${filepath}" is missing deps.`);
        console.log('Missing the following: ', Object.keys(depIssues.missing));
        hasIssues = true;
      }

      if (depIssues.dependencies.length > 0) {
        console.log(`The package at "${filepath}" has unused dependencies.`);
        console.log(
          'The following dependencies are unused:',
          depIssues.dependencies
        );
        hasIssues = true;
      }
    }
  }
  return hasIssues;
}

processPackages().then(hasIssues => {
  if (hasIssues) {
    console.log(
      'There were missing or unused dependencies in one or more packages.'
    );
    process.exit(1);
  } else {
    console.log('No dependency issues found.');
  }
});
