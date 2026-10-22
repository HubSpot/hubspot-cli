import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { commands } from '../../lang/en.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { logError } from '../errorHandlers/index.js';
import { MCP_CLIENTS, McpClientId } from './clients.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SKILLS_SOURCE_DIR = path.join(
  __dirname,
  '..',
  '..',
  'mcp-server',
  'skills'
);

export const MCP_SKILLS = [
  {
    name: 'hubspot-new-app',
    description: commands.mcp.setup.skillDescriptions.newApp,
  },
  {
    name: 'hubspot-fix-build',
    description: commands.mcp.setup.skillDescriptions.fixBuild,
  },
];

export const MCP_SKILL_NAMES = MCP_SKILLS.map(skill => skill.name);

const INSTALLED_SKILL_MARKER = '.installed-by-hubspot-cli';

function getInstalledSkillNames(targetDir: string): string[] {
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  return fs
    .readdirSync(targetDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name =>
      fs.existsSync(path.join(targetDir, name, INSTALLED_SKILL_MARKER))
    );
}

function installSkillsInDir(targetDir: string, skillNames: string[]): void {
  new Set([...getInstalledSkillNames(targetDir), ...skillNames]).forEach(name =>
    fs.rmSync(path.join(targetDir, name), { recursive: true, force: true })
  );

  skillNames.forEach(skillName => {
    const destination = path.join(targetDir, skillName);
    fs.copySync(path.join(SKILLS_SOURCE_DIR, skillName), destination);
    fs.writeFileSync(path.join(destination, INSTALLED_SKILL_MARKER), '');
  });
}

export function installSkills(
  targets: McpClientId[],
  skillNames: string[]
): boolean {
  const skillsToInstall = MCP_SKILL_NAMES.filter(skillName =>
    skillNames.includes(skillName)
  );
  const targetDirs = [
    ...new Set(
      MCP_CLIENTS.filter(client => targets.includes(client.id)).map(client =>
        path.join(os.homedir(), ...client.skillsPathSegments)
      )
    ),
  ];

  SpinniesManager.add('mcpSkills', {
    text: commands.mcp.setup.spinners.installingSkills,
  });

  try {
    targetDirs.forEach(targetDir =>
      installSkillsInDir(targetDir, skillsToInstall)
    );

    SpinniesManager.succeed('mcpSkills', {
      text: commands.mcp.setup.spinners.installedSkills(
        skillsToInstall,
        targetDirs
      ),
    });
    return true;
  } catch (error) {
    SpinniesManager.fail('mcpSkills', {
      text: commands.mcp.setup.spinners.failedToInstallSkills,
    });
    logError(error);
    return false;
  }
}
