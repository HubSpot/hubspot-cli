import readline from 'readline';
import { randomUUID } from 'crypto';
import open from 'open';
import { WebSocket } from 'ws';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import CLIWebSocketServer, {
  CLIWebSocketMessage,
} from '../CLIWebSocketServer.js';
import {
  ACCOUNT_AUTH_UI_MESSAGE_SEND_TYPES,
  ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES,
  ACCOUNT_AUTH_WEBSOCKET_SERVER_VERSION,
} from '../constants.js';
import { personalAccessKeyPrompt } from '../prompts/personalAccessKeyPrompt.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { uiLogger } from '../ui/logger.js';
import { lib } from '../../lang/en.js';
import { PromptExitError } from '../errors/PromptExitError.js';
import { EXIT_CODES } from '../enums/exitCodes.js';

const LOG_PREFIX = '[AccountAuthWebsocketServer]';
const SPINNER_ID = 'pak-websocket';
const CTRL_C = 3;

type PersonalAccessKeyMessageData = {
  personalAccessKey: string;
  cliCallbackToken: string;
};

function isPersonalAccessKeyMessageData(
  data: unknown
): data is PersonalAccessKeyMessageData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.personalAccessKey === 'string' &&
    typeof d.cliCallbackToken === 'string'
  );
}

function buildPakUrl(
  env: string,
  account: number | undefined,
  cliCallbackPort: number,
  cliCallbackToken: string
): string {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  const baseUrl = account
    ? `${websiteOrigin}/personal-access-key/${account}`
    : `${websiteOrigin}/l/personal-access-key`;
  return `${baseUrl}?cliCallbackPort=${cliCallbackPort}&cliCallbackToken=${cliCallbackToken}`;
}

function createMessageHandler(
  server: CLIWebSocketServer,
  cliCallbackToken: string,
  resolveWebsocketPak: (pak: string) => void
) {
  return (ws: WebSocket, message: CLIWebSocketMessage): boolean => {
    if (
      message.type !== ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY
    ) {
      return false;
    }
    if (!isPersonalAccessKeyMessageData(message.data)) {
      return true;
    }
    const { cliCallbackToken: receivedToken, personalAccessKey } = message.data;
    if (receivedToken !== cliCallbackToken) {
      server.sendMessage(ws, {
        type: ACCOUNT_AUTH_UI_MESSAGE_SEND_TYPES.AUTH_FAILED,
        data: { reason: 'cliCallbackTokenMismatch' },
      });
      return true;
    }
    if (personalAccessKey.length === 0) {
      return true;
    }
    server.sendMessage(ws, {
      type: ACCOUNT_AUTH_UI_MESSAGE_SEND_TYPES.AUTH_RECEIVED,
    });
    resolveWebsocketPak(personalAccessKey);
    return true;
  };
}

type WaitResult = { type: 'pak'; pak: string } | { type: 'keypress' };

async function awaitKeypressOrWebsocketPak(
  websocketPakPromise: Promise<string>
): Promise<WaitResult> {
  if (!process.stdin.isTTY) {
    return { type: 'keypress' };
  }

  SpinniesManager.init();
  SpinniesManager.add(SPINNER_ID, {
    text: lib.accountAuthWebsocket.logs.spinner,
  });

  let cleanupStdin: (() => void) | undefined;

  const keypressPromise = new Promise<WaitResult>((resolve, reject) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    const onData = (chunk: Buffer) => {
      doCleanup();
      if (chunk[0] === CTRL_C) {
        return reject(
          new PromptExitError(
            lib.prompts.personalAccessKeyPrompt.errors.authCancelled,
            EXIT_CODES.SUCCESS
          )
        );
      }
      resolve({ type: 'keypress' });
    };

    const doCleanup = () => {
      process.stdin.removeListener('data', onData);
      try {
        process.stdin.setRawMode(false);
      } catch {}
      process.stdin.pause();
    };

    cleanupStdin = doCleanup;
    process.stdin.on('data', onData);
  });

  try {
    const result = await Promise.race([
      websocketPakPromise.then(pak => ({ type: 'pak' as const, pak })),
      keypressPromise,
    ]);

    if (result.type === 'pak') {
      SpinniesManager.succeed(SPINNER_ID, {
        text: lib.accountAuthWebsocket.logs.received,
      });
    } else {
      SpinniesManager.remove(SPINNER_ID);
    }

    return result;
  } catch (e) {
    SpinniesManager.remove(SPINNER_ID);
    throw e;
  } finally {
    cleanupStdin?.();
  }
}

export async function awaitPersonalAccessKeyOverWebsocket({
  env,
  account,
}: {
  env: string;
  account?: number;
}): Promise<string> {
  const cliCallbackToken = randomUUID();
  const server = new CLIWebSocketServer({ logPrefix: LOG_PREFIX });

  let resolveWebsocketPak!: (pak: string) => void;
  const websocketPakPromise = new Promise<string>(resolve => {
    resolveWebsocketPak = resolve;
  });

  try {
    const cliCallbackPort = await server.start({
      metadata: {
        accountAuthWebsocketServerVersion:
          ACCOUNT_AUTH_WEBSOCKET_SERVER_VERSION,
      },
      onMessage: createMessageHandler(
        server,
        cliCallbackToken,
        resolveWebsocketPak
      ),
    });

    const url = buildPakUrl(env, account, cliCallbackPort, cliCallbackToken);
    await open(url, { url: true });
    uiLogger.log(lib.accountAuthWebsocket.logs.openingWebBrowser(url));

    const waitResult = await awaitKeypressOrWebsocketPak(websocketPakPromise);

    if (waitResult.type === 'pak') {
      return waitResult.pak;
    }

    let pastePhaseActive = true;
    websocketPakPromise
      .then(pak => {
        if (pastePhaseActive) {
          process.stdin.push(`${pak}\n`);
        }
      })
      .catch(() => {});

    const personalAccessKey = await personalAccessKeyPrompt();
    pastePhaseActive = false;
    return personalAccessKey;
  } finally {
    server.shutdown();
  }
}
