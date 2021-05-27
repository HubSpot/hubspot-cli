const path = require('path');
const fs = require('fs');

const CHANGELOG_SEPARATOR = '==========';
const CHANGELOG_VERSION_PREFIX = '##';

// const https = require('https');

// const GITHUB_PR_MERGE_COMMIT_PREFIX = 'Merge pull request #';

// const DEFAULT_GITHUB_API_OPTIONS = {
//   hostname: 'api.github.com',
//   port: 443,
//   // path: '/todos',
//   method: 'GET',
// };

// const githubAPIRequest = (options = {}) => {
//   const requestOptions = Object.assign({}, DEFAULT_GITHUB_API_OPTIONS, options);

//   return new Promise((resolve, reject) => {
//     const req = https.request(requestOptions, res => {
//       console.log(`statusCode: ${res.statusCode}`);

//       res.on('data', d => {
//         process.stdout.write(d);
//         resolve(d);
//       });
//     });

//     req.on('error', error => {
//       reject(error);
//     });

//     req.end();
//   });
// };

// const getGithubTags = () => {
//   return githubAPIRequest({
//     path: '/repos/HubSpot/hubspot-cli/git/refs/tags',
//   });
// };

// const getGithubBranchDiff = branch => {
//   return githubAPIRequest({
//     path: `/repos/HubSpot/hubspot-cli/compare/${branch}...master`,
//   });
// };

// const getPullRequestsInLatestTag = async () => {
//   const githubTagsResp = await getGithubTags();
//   console.log('githubTags count: ', githubTagsResp.length);
//   const latestTag = githubTagsResp[githubTagsResp.length - 1];
//   console.log('latestTag: ', latestTag);
//   const githubBranchDiff = await getGithubBranchDiff(latestTag);
//   console.log('githubBranchDiff Commits count: ', githubBranchDiff);

//   const commitsFromPRMerge = githubBranchDiff.commits.reduce(
//     (commitsFromPRMerge, commit) => {
//       const { message } = commit;
//       if (message.startsWith(GITHUB_PR_MERGE_COMMIT_PREFIX)) {
//         const splitMessage = message.split('\n\n');
//         console.log('splitMessage: ', splitMessage);
//         const pullRequestTitle = splitMessage[splitMessage.length - 1];
//         const pullRequestId = splitMessage[0]
//           .replace(GITHUB_PR_MERGE_COMMIT_PREFIX, '')
//           .split(' ')[0];
//         commitsFromPRMerge.push({
//           id: pullRequestId,
//           title: pullRequestTitle,
//         });
//       }
//     },
//     []
//   );

//   console.log('commitsFromPRMerge: ', commitsFromPRMerge);
// };

// getPullRequestsInLatestTag();

// TODO
// Get tags https://api.github.com/repos/HubSpot/hubspot-cli/git/refs/tags
// Get last tag, make sure it has v<Major>.<Minor>.<Patch>-beta.<BetaVersion> format
// Get diff of latest tag and master -- https://api.github.com/repos/HubSpot/hubspot-cli/compare/v3.0.5...master
// Filter resp.commits by commit.message starts with "Merge pull request #<PR_Num> from HubSpot/<branch_name>\n\n<PR Title>"
// Split each commit.message on `\n\n` and get PR number to generate URL https://github.com/HubSpot/hubspot-cli/pull/461

const parseArguments = args => {
  return {
    number: args[2],
    title: args[3],
    url: args[4],
  };
};

const updateChangeLog = prData => {
  const changelogEntry = `\n* ${prData.title} ([#${prData.number}](${prData.url}))`;
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');
  console.log('changelog entry: ', changelogEntry);
  const changelogContent = fs.readFileSync(changelogPath);
  const endOfHeaderIndex =
    changelogContent.indexOf(CHANGELOG_SEPARATOR) + CHANGELOG_SEPARATOR.length;
  const beginningOfPreviousVersionLogIndex = changelogContent.indexOf(
    CHANGELOG_VERSION_PREFIX
  );
  console.log('separator index: ', endOfHeaderIndex);
  console.log('version prefix index: ', beginningOfPreviousVersionLogIndex);
  const addLinebreak =
    beginningOfPreviousVersionLogIndex - endOfHeaderIndex === 1;
  console.log('addLinebreak: ', addLinebreak);
  const newChangelogContent = `${changelogContent.slice(
    0,
    endOfHeaderIndex
  )}${changelogEntry}${addLinebreak ? '\n' : ''}${changelogContent.slice(
    endOfHeaderIndex,
    beginningOfPreviousVersionLogIndex
  )}${changelogContent.slice(beginningOfPreviousVersionLogIndex, -1)}`;
  fs.writeFileSync(changelogPath, newChangelogContent);
};

updateChangeLog(parseArguments(process.argv));
