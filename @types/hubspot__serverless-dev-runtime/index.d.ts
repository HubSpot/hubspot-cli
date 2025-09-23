declare module '@hubspot/serverless-dev-runtime' {
  export interface ServerOptions {
    accountId: number;
    path: string;
    port?: string;
    contact?: boolean;
    watch?: boolean;
    'log-output'?: boolean;
    [key: string]: unknown;
  }

  export function start(options: ServerOptions): void;
}
