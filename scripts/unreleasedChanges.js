#!/usr/bin/env node

import { exec as _exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const exec = promisify(_exec);

async function gitLogForTag(tag) {
  const { stdout } = await exec(
    `git log v${tag}...origin/master --pretty=format:'- %s – @%al.' --no-merges`
  );
  return stdout;
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
      return `\n ${chalk.cyan(`## Diff between ${tag} and master:`)}\n${
        gitLog === '' ? 'No changes' : gitLog
      }`;
    })
    .join('\n');

  console.log(output);
})();
