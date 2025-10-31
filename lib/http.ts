import http from 'http';
import https from 'https';

const IS_SERVER_RUNNING_TIMEOUT = 2000;

export function isServerRunningAtUrl(serverUrl: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    try {
      const url = new URL(serverUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.get(serverUrl);

      req.on('socket', socket => {
        socket.on('connect', () => {
          resolve(true);
          req.destroy();
        });
      });

      req.on('error', (err: NodeJS.ErrnoException) => {
        resolve(err.code !== 'ECONNREFUSED');
      });

      req.end();

      setTimeout(() => resolve(false), IS_SERVER_RUNNING_TIMEOUT);
    } catch (err) {
      resolve(false);
    }
  });
}
