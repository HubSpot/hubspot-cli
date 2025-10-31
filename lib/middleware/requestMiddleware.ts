import { addUserAgentHeader } from '@hubspot/local-dev-lib/http';
import { pkg } from '../jsonLoader.js';

export function setRequestHeaders(): void {
  addUserAgentHeader('HubSpot CLI', pkg.version);
}
