import { Separator } from '@inquirer/prompts';
import {
  AccountLevel,
  DeveloperTestAccountConfig,
} from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { lib } from '../../lang/en.js';
import { promptUser } from './promptUtils.js';

const hubs = {
  MARKETING: 'marketingLevel',
  OPS: 'opsLevel',
  SERVICE: 'serviceLevel',
  SALES: 'salesLevel',
  CONTENT: 'contentLevel',
};

const AccountTiers: Record<string, AccountLevel> = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
};

type HubName = keyof typeof hubs;
type HubLevelKey = ValueOf<typeof hubs>;
export type HubConfig = {
  hub: HubName;
  tier: AccountLevel;
};
type Tier = {
  name: string;
  value: HubConfig;
};

const makeHubTiers = (hubKey: HubName): Tier[] => {
  const hubTypeKey =
    hubKey.toLowerCase() as keyof typeof lib.prompts.createDeveloperTestAccountConfigPrompt.hubTypes;
  const hubName =
    lib.prompts.createDeveloperTestAccountConfigPrompt.hubTypes[hubTypeKey];
  return [
    {
      name: `${hubName} [${AccountTiers.FREE}]`,
      value: { hub: hubKey, tier: AccountTiers.FREE },
    },
    {
      name: `${hubName} [${AccountTiers.STARTER}]`,
      value: { hub: hubKey, tier: AccountTiers.STARTER },
    },
    {
      name: `${hubName} [${AccountTiers.PROFESSIONAL}]`,
      value: { hub: hubKey, tier: AccountTiers.PROFESSIONAL },
    },
    {
      name: `${hubName} [${AccountTiers.ENTERPRISE}]`,
      value: { hub: hubKey, tier: AccountTiers.ENTERPRISE },
    },
  ];
};

const TEST_ACCOUNT_TIERS: (Tier | Separator)[] = [
  ...makeHubTiers('MARKETING'),
  new Separator(),
  ...makeHubTiers('OPS'),
  new Separator(),
  ...makeHubTiers('SERVICE'),
  new Separator(),
  ...makeHubTiers('SALES'),
  new Separator(),
  ...makeHubTiers('CONTENT'),
  new Separator(),
];

export async function createDeveloperTestAccountConfigPrompt(
  args: {
    name?: string;
    description?: string;
  } = {},
  supportFlags: boolean = true
): Promise<DeveloperTestAccountConfig> {
  const { name, description } = args;

  let accountName = name;
  let accountDescription = description;
  let accountLevelsArray: HubConfig[] = [];

  if (!accountName) {
    const namePromptResult = await promptUser<{ accountName: string }>({
      name: 'accountName',
      message:
        lib.prompts.createDeveloperTestAccountConfigPrompt.namePrompt(
          supportFlags
        ),
      type: 'input',
      validate: value => {
        if (!value) {
          return lib.prompts.createDeveloperTestAccountConfigPrompt.errors
            .nameRequired;
        }
        return true;
      },
    });
    accountName = namePromptResult.accountName;
  }

  if (!accountDescription) {
    const descriptionPromptResult = await promptUser<{ description: string }>({
      name: 'description',
      message:
        lib.prompts.createDeveloperTestAccountConfigPrompt.descriptionPrompt(
          supportFlags
        ),
      type: 'input',
    });
    accountDescription = descriptionPromptResult.description;
  }

  const useDefaultAccountLevelsPromptResult = await promptUser<{
    useDefaultAccountLevels: 'default' | 'manual';
  }>({
    name: 'useDefaultAccountLevels',
    message:
      lib.prompts.createDeveloperTestAccountConfigPrompt
        .useDefaultAccountLevelsPrompt.message,
    type: 'list',
    choices: [
      {
        name: lib.prompts.createDeveloperTestAccountConfigPrompt
          .useDefaultAccountLevelsPrompt.default,
        value: 'default',
      },
      {
        name: lib.prompts.createDeveloperTestAccountConfigPrompt
          .useDefaultAccountLevelsPrompt.manual,
        value: 'manual',
      },
    ],
  });

  if (
    useDefaultAccountLevelsPromptResult.useDefaultAccountLevels === 'default'
  ) {
    accountLevelsArray = [
      { hub: 'MARKETING', tier: AccountTiers.ENTERPRISE },
      { hub: 'OPS', tier: AccountTiers.ENTERPRISE },
      { hub: 'SERVICE', tier: AccountTiers.ENTERPRISE },
      { hub: 'SALES', tier: AccountTiers.ENTERPRISE },
      { hub: 'CONTENT', tier: AccountTiers.ENTERPRISE },
    ];
  } else {
    const accountLevelsPromptResult = await promptUser({
      name: 'testAccountLevels',
      message: lib.prompts.createDeveloperTestAccountConfigPrompt.tiersPrompt,
      type: 'checkbox',
      pageSize: 13,
      choices: TEST_ACCOUNT_TIERS,
      loop: false,
      validate: choices => {
        if (choices?.length < Object.keys(hubs).length) {
          return lib.prompts.createDeveloperTestAccountConfigPrompt.errors
            .allHubsRequired;
        } else {
          const hubMap: Record<string, boolean> = {};
          for (const choice of choices) {
            const { hub } = choice.value;
            if (hubMap[hub]) {
              return lib.prompts.createDeveloperTestAccountConfigPrompt.errors
                .tiersError;
            }
            hubMap[hub] = true;
          }
        }
        return true;
      },
    });
    accountLevelsArray = accountLevelsPromptResult.testAccountLevels;
  }

  const accountLevels = accountLevelsArray.reduce<{
    [key in HubLevelKey]?: AccountLevel;
  }>((acc, level) => {
    const { hub: hubName, tier: hubTier } = level;
    const hubLevel = hubs[hubName];

    acc[hubLevel] = hubTier;
    return acc;
  }, {});

  return {
    accountName: accountName!,
    description: accountDescription,
    ...accountLevels,
  };
}
