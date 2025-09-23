import { addUserAgentHeader } from '@hubspot/local-dev-lib/http';
import pkg from '../../package.json' with { type: 'json' };

export function setRequestHeaders(): void {
  addUserAgentHeader('HubSpot CLI', pkg.version);
}
