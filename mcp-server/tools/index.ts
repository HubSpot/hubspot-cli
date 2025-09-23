import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { UploadProjectTools } from './project/UploadProjectTools.js';
import { CreateProjectTool } from './project/CreateProjectTool.js';
import { GuidedWalkthroughTool } from './project/GuidedWalkthroughTool.js';
import { DeployProjectTool } from './project/DeployProjectTool.js';
import { AddFeatureToProjectTool } from './project/AddFeatureToProjectTool.js';
import { ValidateProjectTool } from './project/ValidateProjectTool.js';
import { GetConfigValuesTool } from './project/GetConfigValuesTool.js';
import { DocsSearchTool } from './project/DocsSearchTool.js';
import { DocFetchTool } from './project/DocFetchTool.js';
import { HsListTool } from './cms/HsListTool.js';
import { HsCreateModuleTool } from './cms/HsCreateModuleTool.js';
import { HsCreateTemplateTool } from './cms/HsCreateTemplateTool.js';
import { HsCreateFunctionTool } from './cms/HsCreateFunctionTool.js';
import { HsListFunctionsTool } from './cms/HsListFunctionsTool.js';
import { HsFunctionLogsTool } from './cms/HsFunctionLogsTool.js';

export function registerProjectTools(mcpServer: McpServer): RegisteredTool[] {
  return [
    new UploadProjectTools(mcpServer).register(),
    new CreateProjectTool(mcpServer).register(),
    new GuidedWalkthroughTool(mcpServer).register(),
    new DeployProjectTool(mcpServer).register(),
    new AddFeatureToProjectTool(mcpServer).register(),
    new ValidateProjectTool(mcpServer).register(),
    new GetConfigValuesTool(mcpServer).register(),
    new DocsSearchTool(mcpServer).register(),
    new DocFetchTool(mcpServer).register(),
  ];
}

export function registerCmsTools(mcpServer: McpServer): RegisteredTool[] {
  return [
    new HsListTool(mcpServer).register(),
    new HsCreateModuleTool(mcpServer).register(),
    new HsCreateTemplateTool(mcpServer).register(),
    new HsCreateFunctionTool(mcpServer).register(),
    new HsListFunctionsTool(mcpServer).register(),
    new HsFunctionLogsTool(mcpServer).register(),
  ];
}
