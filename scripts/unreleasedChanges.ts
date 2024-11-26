import { exec as _exec } from 'child_process';
import util from 'util';

const exec = util.promisify(_exec);

async function gitLogForTag(tag: string) {
  const { stdout } = await exec(
    `git log v${tag}...main --pretty=format:'- %s – @%al.' --no-merges`
  );
  return stdout;
}

async function outputEnvVariable(name: string, value: string) {
  await exec(
    `echo "${name}<<EOF" >> $GITHUB_ENV && echo "${value}" >> $GITHUB_ENV && echo "EOF" >> $GITHUB_ENV`
  );
}
(async () => {
  const { stdout } = await exec('npm view @hubspot/cli dist-tags --json');
  const { next, latest } = JSON.parse(stdout);

  const logs = [
    ['latest', await gitLogForTag(latest)],
    ['next', await gitLogForTag(next)],
  ];

  const output = logs
    .map(item => {
      const [tag, gitLog] = item;
      return `\n ## Diff between ${tag} and main:\n${
        gitLog === '' ? 'No changes' : gitLog
      }`;
    })
    .join('\n');

  await Promise.all([
    outputEnvVariable('LOG', output),
    outputEnvVariable('NEXT_TAG', next),
    outputEnvVariable('LATEST_TAG', latest),
  ]);
})();
