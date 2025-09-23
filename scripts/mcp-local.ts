import {
  setupClaudeCode,
  setupCursor,
  setupVsCode,
  setupWindsurf,
} from '../lib/mcp/setup.ts';
import path from 'path';
import { fileURLToPath } from 'url';
import SpinniesManager from '../lib/ui/SpinniesManager.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async function () {
  SpinniesManager.init();
  const repoRoot = path.join(__dirname, '..');
  const localMcpCommand = {
    command: path.join(repoRoot, 'dist', 'bin', 'hs'),
    args: ['mcp', 'start'],
  };

  await setupClaudeCode(localMcpCommand);
  setupWindsurf(localMcpCommand);
  setupCursor(localMcpCommand);
  await setupVsCode(localMcpCommand);
})();
