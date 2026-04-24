import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type LoggingLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency';

export class McpLogger {
  private mcpServer: McpServer;

  constructor(mcpServer: McpServer) {
    this.mcpServer = mcpServer;
  }

  private log(level: LoggingLevel, logger: string, data: unknown): void {
    try {
      this.mcpServer.sendLoggingMessage({ level, logger, data });
    } catch (error) {
      // sendLoggingMessage can throw if no transport is connected or the
      // client doesn't support logging. Write to stderr so failures surface
      // somewhere without corrupting the stdio JSON-RPC stream.
      process.stderr.write(
        `[McpLogger] Failed to send log message: ${error}\n`
      );
    }
  }

  debug(logger: string, data: unknown): void {
    this.log('debug', logger, data);
  }

  info(logger: string, data: unknown): void {
    this.log('info', logger, data);
  }

  warn(logger: string, data: unknown): void {
    this.log('warning', logger, data);
  }

  error(logger: string, data: unknown): void {
    this.log('error', logger, data);
  }
}
