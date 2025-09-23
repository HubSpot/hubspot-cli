import util from 'util';
import { exec } from 'node:child_process';

export const execAsync = util.promisify(exec);

export function addFlag(
  command: string,
  flagName: string,
  value: string | number | boolean | string[]
): string {
  if (Array.isArray(value)) {
    return `${command} --${flagName} ${value.map(item => `"${item}"`).join(' ')}`;
  }
  return `${command} --${flagName} "${value}"`;
}
