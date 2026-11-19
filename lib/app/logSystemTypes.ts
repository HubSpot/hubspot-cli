export const SYSTEM_TYPE_DISPLAY_NAMES: { [key: string]: string } = {
  WEBHOOKS: 'Webhooks',
  API_CALL: 'API Call',
  SERVERLESS_EXECUTION: 'Serverless Function',
  CRM_EXTENSIBILITY_CARD: 'CRM Card',
  CRM_LEGACY_CARD: 'CRM Legacy Card',
  EXTENSION_LOG: 'Extension Log',
  EXTENSION_RENDER: 'Extension Render',
  APP_SETTINGS: 'App Settings',
  PROXY_EXECUTION: 'Proxy Execution',
  SERVERLESS_GATEWAY_EXECUTION: 'Serverless Gateway Execution',
  ACCEPTANCE_TEST: 'Acceptance Test',
  OAUTH_AUTHORIZATION: 'OAuth Authorization',
};

export function toTypeChoice(systemType: string): string {
  return systemType.toLowerCase().replaceAll('_', '-');
}
