import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

import { promptUser } from '../lib/prompts/promptUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSymLinksInDirectory(directory: string): string[] {
  return fs
    .readdirSync(directory, { recursive: false })
    .map((item: string | Buffer<ArrayBufferLike>) => item.toString())
    .filter((item: string) => {
      const stats = fs.lstatSync(path.join(directory, item));
      return stats.isSymbolicLink() && !item.includes('.bin');
    });
}

function addPackagePrefix(packages: string[]) {
  return packages.map((item: string) => {
    return `${hubspotPackagePrefix}/${item}`;
  });
}

const hubspotPackagePrefix = '@hubspot';
const node_modules = path.join(
  __dirname,
  '..',
  'node_modules',
  hubspotPackagePrefix
);

const yarnLinkPath = path.join(
  os.homedir(),
  '.config',
  'yarn',
  'link',
  hubspotPackagePrefix
);

(async () => {
  const currentlyInstalledLinks = addPackagePrefix(
    getSymLinksInDirectory(node_modules)
  );

  const installablePackages = addPackagePrefix(
    getSymLinksInDirectory(yarnLinkPath)
  );

  const { packagesToLink } = await promptUser({
    name: 'packagesToLink',
    message: 'Which packages would you like to link?',
    type: 'checkbox',
    choices: installablePackages.map((choice: string) => {
      return {
        value: choice,
        name: choice,
        checked: currentlyInstalledLinks.includes(choice),
      };
    }),
  });

  packagesToLink.forEach((pkg: string) => {
    console.log(chalk.cyan(`\nLinking package: ${pkg}`));
    execSync(`yarn link ${pkg}`, { stdio: 'inherit' });
  });

  currentlyInstalledLinks.forEach(pkg => {
    if (!packagesToLink.includes(pkg)) {
      console.log(chalk.yellow(`\nUnlinking package: ${pkg}`));
      execSync(`yarn unlink ${pkg}`, { stdio: 'inherit' });
    }
  });

  execSync('yarn install --force', { stdio: 'inherit' });
})();
