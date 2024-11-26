import { exec as _exec } from 'child_process';
import util from 'util';

const exec = util.promisify(_exec);

function gitLogForTag(tag: string) {
  return exec(
    `git log ${tag}...main --pretty=format:'- %s – @%al.' --no-merges`
  );
}
(async () => {
  const { stdout } = await exec('npm view @hubspot/cli dist-tags --json');
  const { next, experiment, latest } = JSON.parse(stdout);
  const logs = [
    ['latest', await gitLogForTag(latest)],
    ['next', await gitLogForTag(next)],
    ['experimental', await gitLogForTag(experiment)],
  ];

  const output = logs
    .map(item => {
      const [tag, gitLog] = item;
      return `Diff between ${tag} and main:\n${gitLog}`;
    })
    .join('\n');

  console.log(output);
})();

// export LOG=`git log $MOST_RECENT_TAG..main --pretty=format:'- %s – @%al.' --no-merges`
// echo $LOG
//
// echo "MOST_RECENT_TAG<<EOF" >> $GITHUB_ENV
// echo $MOST_RECENT_TAG >> $GITHUB_ENV
// echo "EOF" >> $GITHUB_ENV
//
// echo "LOG<<EOF" >> $GITHUB_ENV
// echo "$LOG" >> $GITHUB_ENV
// echo "EOF" >> $GITHUB_ENV
