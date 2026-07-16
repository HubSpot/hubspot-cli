import open from 'open';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { Mock } from 'vitest';
import CLIWebSocketServer, {
  CLIWebSocketMessage,
} from '../../CLIWebSocketServer.js';
import { WebSocket } from 'ws';
import {
  ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES,
  ACCOUNT_AUTH_UI_MESSAGE_SEND_TYPES,
} from '../../constants.js';
import * as personalAccessKeyPromptModule from '../../prompts/personalAccessKeyPrompt.js';
import * as SpinniesManagerModule from '../../ui/SpinniesManager.js';
import { awaitPersonalAccessKeyOverWebsocket } from '../awaitPersonalAccessKeyOverWebsocket.js';

vi.mock('open', () => ({ default: vi.fn() }));
vi.mock('@hubspot/local-dev-lib/urls');
vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('../../CLIWebSocketServer.js');
vi.mock('../../prompts/personalAccessKeyPrompt.js');
vi.mock('../../ui/SpinniesManager.js', () => ({
  default: {
    init: vi.fn(),
    add: vi.fn(),
    succeed: vi.fn(),
    remove: vi.fn(),
  },
}));

const TOKEN = 'fixed-token-1234';
const PORT = 54321;
const ORIGIN = 'https://app.hubspot.com';

const mockedOpen = open as unknown as Mock;
const mockedGetHubSpotWebsiteOrigin = getHubSpotWebsiteOrigin as Mock;
const mockedPromptForPersonalAccessKey = vi.mocked(
  personalAccessKeyPromptModule.personalAccessKeyPrompt
);

let serverInstance: {
  start: Mock;
  shutdown: Mock;
  sendMessage: Mock;
};
let onMessageHandler:
  ((ws: WebSocket, message: CLIWebSocketMessage) => boolean) | undefined;

beforeEach(async () => {
  const { randomUUID } = await import('crypto');
  (randomUUID as unknown as Mock).mockReturnValue(TOKEN);

  mockedGetHubSpotWebsiteOrigin.mockReturnValue(ORIGIN);
  mockedPromptForPersonalAccessKey.mockResolvedValue('prompt-pak');

  serverInstance = {
    start: vi.fn(async ({ onMessage }) => {
      onMessageHandler = onMessage;
      return PORT;
    }),
    shutdown: vi.fn(),
    sendMessage: vi.fn(),
  };

  (CLIWebSocketServer as unknown as Mock).mockImplementation(
    () => serverInstance
  );

  Object.defineProperty(process.stdin, 'isTTY', {
    value: false,
    configurable: true,
  });
});

describe('awaitPersonalAccessKeyOverWebsocket', () => {
  it('opens the browser to the PAK URL with cliCallbackPort and cliCallbackToken', async () => {
    const promise = awaitPersonalAccessKeyOverWebsocket({ env: 'prod' });

    await Promise.resolve();
    await Promise.resolve();

    expect(mockedOpen).toHaveBeenCalledWith(
      `${ORIGIN}/l/personal-access-key?cliCallbackPort=${PORT}&cliCallbackToken=${TOKEN}`,
      { url: true }
    );

    onMessageHandler!({} as WebSocket, {
      type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
      data: { personalAccessKey: 'test-pak', cliCallbackToken: TOKEN },
    });

    await promise;
  });

  it('uses the account-scoped URL when account is provided', async () => {
    const promise = awaitPersonalAccessKeyOverWebsocket({
      env: 'prod',
      account: 12345,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(mockedOpen).toHaveBeenCalledWith(
      `${ORIGIN}/personal-access-key/12345?cliCallbackPort=${PORT}&cliCallbackToken=${TOKEN}`,
      { url: true }
    );

    onMessageHandler!({} as WebSocket, {
      type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
      data: { personalAccessKey: 'test-pak', cliCallbackToken: TOKEN },
    });

    await promise;
  });

  it('returns the PAK from the websocket in non-TTY mode without prompting', async () => {
    const ws = {} as WebSocket;
    const promise = awaitPersonalAccessKeyOverWebsocket({ env: 'prod' });

    await Promise.resolve();
    await Promise.resolve();

    onMessageHandler!(ws, {
      type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
      data: { personalAccessKey: 'websocket-pak', cliCallbackToken: TOKEN },
    });

    const result = await promise;

    expect(result).toBe('websocket-pak');
    expect(mockedPromptForPersonalAccessKey).not.toHaveBeenCalled();
    expect(serverInstance.shutdown).toHaveBeenCalled();
  });

  it('returns false for unrelated websocket message types', async () => {
    const promise = awaitPersonalAccessKeyOverWebsocket({ env: 'prod' });

    await Promise.resolve();
    await Promise.resolve();

    const handled = onMessageHandler!({} as WebSocket, {
      type: 'client:something-else',
      data: {},
    });

    expect(handled).toBe(false);

    onMessageHandler!({} as WebSocket, {
      type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
      data: { personalAccessKey: 'test-pak', cliCallbackToken: TOKEN },
    });

    await promise;
  });

  it('sends AUTH_FAILED and keeps waiting when cliCallbackToken mismatches', async () => {
    const ws = {} as WebSocket;
    const promise = awaitPersonalAccessKeyOverWebsocket({ env: 'prod' });

    await Promise.resolve();
    await Promise.resolve();

    onMessageHandler!(ws, {
      type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
      data: { personalAccessKey: 'wrong', cliCallbackToken: 'bad-token' },
    });

    expect(serverInstance.sendMessage).toHaveBeenCalledWith(ws, {
      type: ACCOUNT_AUTH_UI_MESSAGE_SEND_TYPES.AUTH_FAILED,
      data: { reason: 'cliCallbackTokenMismatch' },
    });

    onMessageHandler!(ws, {
      type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
      data: { personalAccessKey: 'test-pak', cliCallbackToken: TOKEN },
    });

    await promise;
  });

  it('shuts down the server if the start call rejects', async () => {
    serverInstance.start.mockRejectedValue(new Error('bind failure'));

    await expect(
      awaitPersonalAccessKeyOverWebsocket({ env: 'prod' })
    ).rejects.toThrow('bind failure');
    expect(serverInstance.shutdown).toHaveBeenCalled();
  });

  describe('when websocket delivers PAK', () => {
    it('resolves with websocket PAK and sends AUTH_RECEIVED (spinner phase)', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });

      const spinniesManager = SpinniesManagerModule.default;
      const setRawModeSpy = vi.fn();
      const pauseSpy = vi.fn();
      const onSpy = vi.fn();
      Object.assign(process.stdin, {
        setRawMode: setRawModeSpy,
        pause: pauseSpy,
        on: onSpy,
        removeListener: vi.fn(),
      });

      const ws = {} as WebSocket;

      const promise = awaitPersonalAccessKeyOverWebsocket({ env: 'prod' });

      await Promise.resolve();
      await Promise.resolve();

      onMessageHandler!(ws, {
        type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
        data: { personalAccessKey: 'websocket-pak', cliCallbackToken: TOKEN },
      });

      const result = await promise;

      expect(result).toBe('websocket-pak');
      expect(serverInstance.sendMessage).toHaveBeenCalledWith(ws, {
        type: ACCOUNT_AUTH_UI_MESSAGE_SEND_TYPES.AUTH_RECEIVED,
      });
      expect(spinniesManager.succeed).toHaveBeenCalledWith(
        'pak-websocket',
        expect.objectContaining({ text: expect.any(String) })
      );
      expect(mockedPromptForPersonalAccessKey).not.toHaveBeenCalled();
    });

    it('pushes PAK to stdin to auto-fill paste prompt when websocket delivers during paste phase', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });

      const stdinPushSpy = vi
        .spyOn(process.stdin, 'push')
        .mockImplementation(() => true);

      const setRawModeSpy = vi.fn();
      const pauseSpy = vi.fn();
      let capturedDataHandler: ((chunk: Buffer) => void) | undefined;
      const onSpy = vi
        .fn()
        .mockImplementation(
          (event: string, handler: (chunk: Buffer) => void) => {
            if (event === 'data') {
              capturedDataHandler = handler;
            }
          }
        );
      Object.assign(process.stdin, {
        setRawMode: setRawModeSpy,
        pause: pauseSpy,
        on: onSpy,
        removeListener: vi.fn(),
      });

      let resolvePrompt!: (v: string) => void;
      mockedPromptForPersonalAccessKey.mockReturnValue(
        new Promise(r => {
          resolvePrompt = r;
        })
      );

      const ws = {} as WebSocket;
      const promise = awaitPersonalAccessKeyOverWebsocket({ env: 'prod' });

      await Promise.resolve();
      await Promise.resolve();

      capturedDataHandler!(Buffer.from([65]));

      await vi.waitFor(() =>
        expect(mockedPromptForPersonalAccessKey).toHaveBeenCalled()
      );

      onMessageHandler!(ws, {
        type: ACCOUNT_AUTH_UI_MESSAGE_RECEIVE_TYPES.PERSONAL_ACCESS_KEY,
        data: { personalAccessKey: 'ws-autofill-pak', cliCallbackToken: TOKEN },
      });

      await Promise.resolve();

      expect(stdinPushSpy).toHaveBeenCalledWith('ws-autofill-pak\n');

      resolvePrompt('ws-autofill-pak');
      await promise;

      stdinPushSpy.mockRestore();
    });
  });
});
