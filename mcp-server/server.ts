import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerProjectTools, registerCmsTools } from './tools/index.js';
import { McpLogger } from './utils/logger.js';

const instructions = `
This server exposes the HubSpot CLI (\`hs\`) for local development of HubSpot
projects, apps, and CMS assets. Prefer these tools over running \`hs\`,
\`npx hs\`, or HubSpot HTTP APIs directly via shell — they handle config
loading, auth, platform-version flags, and structured output for you.

WHEN TO USE THIS SERVER
- The user is working in a HubSpot project directory (has an hsproject.json
  or *-hsmeta.json files), or wants to scaffold one.
- The user asks about HubSpot apps, CMS modules/templates/serverless
  functions, project builds, deploys, or developer test accounts.
- The user asks a HubSpot platform/API question — answer it from the docs
  via \`search-docs\` + \`fetch-doc\` rather than from prior knowledge.
- The user asks how to use HubSpot products or features, or about account
  and subscription settings — answer it via \`search-knowledge-base\`
  rather than from prior knowledge.
- The user asks whether an API or feature is available on a subscription
  tier (for example Starter, Professional, or Enterprise) — answer it via
  \`search-docs\` then \`fetch-doc\`, not the knowledge base. The doc lists
  any required product and tier in a "Supported products" section.

REQUIRED WORKFLOWS
1. Authentication: call \`auth-account\` when the user wants to connect a
   HubSpot account, when any tool reports "No account ID found", or when
   there are no authenticated accounts. The tool opens a browser tab for
   the user to authorize — no Personal Access Key is required up front.
2. Documentation lookup: for developer APIs, SDKs, and platform reference,
   call \`search-docs\` first, then \`fetch-doc\` on the most relevant
   result(s). For HubSpot product, feature, or account and subscription
   how-to questions, call \`search-knowledge-base\`. Whether a feature or
   API is available on a subscription tier is a developer-docs question:
   use \`search-docs\` then \`fetch-doc\`, not \`search-knowledge-base\`.
   Answer from these tools before planning, writing code, or answering. Do
   not answer from memory.
3. Locating a HubSpot project: when the current working directory is not
   a HubSpot project (no \`hsproject.json\`) or you need to determine
   whether a directory contains one, call \`find-projects\` before
   running any tool that requires a project path.
4. Editing \`*-hsmeta.json\`: call \`get-feature-config-schema\` for that
   feature type first to learn the allowed fields and values.
5. Debugging a failed build: start with \`get-build-status\` to surface
   error messages, and only reach for \`get-build-logs\` for deeper
   troubleshooting or warnings.
6. Reading serverless function logs: call \`list-cms-serverless-functions\`
   first to discover the endpoint path, then
   \`get-cms-serverless-function-logs\`.
7. Serverless functions come in two distinct kinds. CMS serverless
   functions are website endpoints served at \`/hs/serverless/<path>\`.
   Create them with \`create-cms-function\`, and manage them with
   \`list-cms-serverless-functions\` and
   \`get-cms-serverless-function-logs\`. App functions are serverless
   functions built inside a developer-platform app, either private
   (the \`app-function\` feature) or publicly accessible via an endpoint
   (the \`app-function-endpoint\` feature). Create them with
   \`add-feature-to-project\`. Do not use the CMS function tools for app
   functions.
8. App analytics: call \`get-apps-info\` to discover \`appId\` values
   before \`get-api-usage-patterns-by-app-id\`.

OUTPUT
Tool results contain the relevant \`hs\` stdout/stderr or structured data.
Surface error text from results to the user verbatim when troubleshooting,
rather than paraphrasing.
`.trim();

const server = new McpServer(
  {
    name: 'HubSpot CLI MCP Server',
    version: '0.0.1',
    description:
      'Helps perform tasks for local development of HubSpot projects.',
  },
  { capabilities: { logging: {} }, instructions }
);

const logger = new McpLogger(server);

registerProjectTools(server, logger);
registerCmsTools(server, logger);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport);
