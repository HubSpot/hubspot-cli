import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../utils/logger.js';
import { UploadProjectTools } from './project/UploadProjectTools.js';
import { CreateProjectTool } from './project/CreateProjectTool.js';
import { GuidedWalkthroughTool } from './project/GuidedWalkthroughTool.js';
import { DeployProjectTool } from './project/DeployProjectTool.js';
import { AddFeatureToProjectTool } from './project/AddFeatureToProjectTool.js';
import { ValidateProjectTool } from './project/ValidateProjectTool.js';
import { GetConfigValuesTool } from './project/GetConfigValuesTool.js';
import { DocsSearchTool } from './project/DocsSearchTool.js';
import { DocFetchTool } from './project/DocFetchTool.js';
import { GetApiUsagePatternsByAppIdTool } from './project/GetApiUsagePatternsByAppIdTool.js';
import { GetApplicationInfoTool } from './project/GetApplicationInfoTool.js';
import { GetBuildLogsTool } from './project/GetBuildLogsTool.js';
import { GetBuildStatusTool } from './project/GetBuildStatusTool.js';
import { HsListTool } from './cms/HsListTool.js';
import { HsCreateModuleTool } from './cms/HsCreateModuleTool.js';
import { HsCreateTemplateTool } from './cms/HsCreateTemplateTool.js';
import { HsCreateFunctionTool } from './cms/HsCreateFunctionTool.js';
import { HsListFunctionsTool } from './cms/HsListFunctionsTool.js';
import { HsFunctionLogsTool } from './cms/HsFunctionLogsTool.js';
import { CreateTestAccountTool } from './project/CreateTestAccountTool.js';

export function registerProjectTools(
  mcpServer: McpServer,
  logger: McpLogger
): RegisteredTool[] {
  return [
    new UploadProjectTools(mcpServer, logger).register(),
    new CreateProjectTool(mcpServer, logger).register(),
    new GuidedWalkthroughTool(mcpServer, logger).register(),
    new CreateTestAccountTool(mcpServer, logger).register(),
    new DeployProjectTool(mcpServer, logger).register(),
    new AddFeatureToProjectTool(mcpServer, logger).register(),
    new ValidateProjectTool(mcpServer, logger).register(),
    new GetConfigValuesTool(mcpServer, logger).register(),
    new DocsSearchTool(mcpServer, logger).register(),
    new DocFetchTool(mcpServer, logger).register(),
    new GetApiUsagePatternsByAppIdTool(mcpServer, logger).register(),
    new GetApplicationInfoTool(mcpServer, logger).register(),
    new GetBuildLogsTool(mcpServer, logger).register(),
    new GetBuildStatusTool(mcpServer, logger).register(),
  ];
}

export function registerCmsTools(
  mcpServer: McpServer,
  logger: McpLogger
): RegisteredTool[] {
  return [
    new HsListTool(mcpServer, logger).register(),
    new HsCreateModuleTool(mcpServer, logger).register(),
    new HsCreateTemplateTool(mcpServer, logger).register(),
    new HsCreateFunctionTool(mcpServer, logger).register(),
    new HsListFunctionsTool(mcpServer, logger).register(),
    new HsFunctionLogsTool(mcpServer, logger).register(),
  ];
}
