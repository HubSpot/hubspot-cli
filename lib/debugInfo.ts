import { version } from '../package.json';
import { getPlatform } from './environment';
import { Arguments } from 'yargs';

interface CustomOptions {
  debug?: boolean;
}

export function logDebugInfo({ debug }: Arguments<CustomOptions>): void {
  if (!debug) {
    return;
  }
  console.log('');
  console.log('Debugging info');
  console.log('==============');
  console.log(`CLI version: ${version}`);
  console.log(`node version: ${process.version}`);
  console.log(`platform: ${getPlatform()}`);
  console.log('');
}
