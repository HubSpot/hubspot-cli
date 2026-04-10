import { Argv, ArgumentsCamelCase } from 'yargs';
import { http } from '@hubspot/local-dev-lib/http';
import { HttpOptions } from '@hubspot/local-dev-lib/types/Http';
import { getHubSpotApiOrigin } from '@hubspot/local-dev-lib/urls';
import { getConfigAccountEnvironment } from '@hubspot/local-dev-lib/config';
import {
  logError,
  debugError,
  ApiErrorContext,
} from '../lib/errorHandlers/index.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { commands } from '../lang/en.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  AccountArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { uiLogger } from '../lib/ui/logger.js';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | Array<JSONValue>;

const command = 'api <endpoint>';
const describe = commands.api.describe;

export type ApiArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs &
  JSONOutputArgs & {
    endpoint: string;
    method?: HttpMethod;
    data?: string;
  };

function parseRequestData(data: string): Record<string, JSONValue> | undefined {
  try {
    return JSON.parse(data) as Record<string, JSONValue>;
  } catch {
    return undefined;
  }
}

function resolveMethod(args: ArgumentsCamelCase<ApiArgs>): HttpMethod {
  if (args.method) {
    return args.method;
  }
  return args.data ? 'POST' : 'GET';
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
}

async function handler(args: ArgumentsCamelCase<ApiArgs>): Promise<void> {
  const {
    endpoint,
    data,
    derivedAccountId,
    json: formatOutputAsJson,
    exit,
    addUsageMetadata,
  } = args;
  const method = resolveMethod(args);

  addUsageMetadata({ action: method });

  let parsedData: Record<string, JSONValue> | undefined;
  if (data) {
    parsedData = parseRequestData(data);
    if (parsedData === undefined) {
      uiLogger.error(commands.api.errors.invalidJson);
      return exit(EXIT_CODES.ERROR);
    }
  }

  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const env = getConfigAccountEnvironment(derivedAccountId);
  const baseUrl = getHubSpotApiOrigin(env);
  const fullUrl = `${baseUrl}/${normalizedEndpoint}`;

  if (!formatOutputAsJson) {
    uiLogger.log(commands.api.requestLog(method, fullUrl));
    if (parsedData) {
      uiLogger.log(commands.api.requestBodyLog(JSON.stringify(parsedData)));
    }
    uiLogger.log('');
  }

  try {
    const requestOptions: HttpOptions = {
      url: normalizedEndpoint,
    };

    if (parsedData) {
      requestOptions.data = parsedData;
      requestOptions.headers = { 'Content-Type': 'application/json' };
    }

    let response;
    switch (method) {
      case 'GET':
        response = await http.get(derivedAccountId, requestOptions);
        break;
      case 'POST':
        response = await http.post(derivedAccountId, requestOptions);
        break;
      case 'PUT':
        response = await http.put(derivedAccountId, requestOptions);
        break;
      case 'PATCH':
        response = await http.patch(derivedAccountId, requestOptions);
        break;
      case 'DELETE':
        response = await http.delete(derivedAccountId, requestOptions);
        break;
    }

    if (response !== undefined) {
      const responseData = response.data as Record<string, JSONValue>;
      if (formatOutputAsJson) {
        uiLogger.json(responseData);
      } else {
        uiLogger.log(commands.api.responseLog);
        uiLogger.log(JSON.stringify(responseData, null, 2));
      }
    }
  } catch (error) {
    const errorContext = new ApiErrorContext({
      accountId: derivedAccountId,
      request: `api ${method} ${endpoint}`,
    });

    if (!isHubSpotHttpError(error)) {
      logError(error, errorContext);
      return exit(EXIT_CODES.ERROR);
    }

    debugError(error, errorContext);

    const errorData = error.data as Record<string, JSONValue> | undefined;
    if (formatOutputAsJson && errorData) {
      uiLogger.json(errorData);
    } else if (errorData) {
      if (error.status && error.statusText) {
        uiLogger.error(
          commands.api.errors.statusLine(error.status, error.statusText)
        );
      }
      uiLogger.log(JSON.stringify(errorData, null, 2));
    } else {
      if (error.status && error.statusText) {
        uiLogger.error(
          commands.api.errors.statusLine(error.status, error.statusText)
        );
      }
      uiLogger.error(error.message);
    }

    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
}

function apiBuilder(yargs: Argv): Argv<ApiArgs> {
  yargs.positional('endpoint', {
    describe: commands.api.positionals.endpoint.describe,
    type: 'string',
  });

  yargs.option('method', {
    alias: 'X',
    describe: commands.api.options.method.describe,
    type: 'string',
    choices: [...HTTP_METHODS, ...HTTP_METHODS.map(m => m.toLowerCase())],
    coerce: (value: string) => value.toUpperCase(),
  });

  yargs.option('data', {
    describe: commands.api.options.data.describe,
    type: 'string',
  });

  yargs.example([
    ['$0 api /crm/v3/objects/contacts', 'Fetch contacts using GET'],
    [
      '$0 api /crm/v3/objects/contacts -X POST --data \'{"properties":{"email":"test@example.com"}}\'',
      'Create a contact',
    ],
    ['$0 api /crm/v3/objects/deals/123', 'Fetch a specific deal'],
    [
      '$0 api /crm/v3/objects/contacts -a my-sandbox',
      'Fetch contacts from a specific account',
    ],
  ]);

  return yargs as Argv<ApiArgs>;
}

const builder = makeYargsBuilder<ApiArgs>(
  apiBuilder,
  command,
  commands.api.verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useJSONOutputOptions: true,
  }
);

const apiCommand: YargsCommandModule<unknown, ApiArgs> = {
  command,
  describe,
  builder,
  handler: makeYargsHandlerWithUsageTracking('api', handler),
};

export default apiCommand;
