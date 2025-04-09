import { addUserAgentHeader } from '@hubspot/local-dev-lib/http';
import pkg from '../../package.json';

export function setRequestHeaders(): void {
  addUserAgentHeader('HubSpot CLI', pkg.version);
}
