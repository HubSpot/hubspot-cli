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
  COMMERCE: 'commerceLevel',
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

const makeHubTiers = (hubKey: HubName, omitTiers?: AccountLevel[]): Tier[] => {
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
  ].filter(tier => !omitTiers || !omitTiers.includes(tier.value.tier));
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
  ...makeHubTiers('COMMERCE', [AccountTiers.STARTER]),
  new Separator(),
];

export async function createDeveloperTestAccountConfigPrompt(
  args: {
    name?: string;
    description?: string;
    marketingLevel?: AccountLevel;
    opsLevel?: AccountLevel;
    serviceLevel?: AccountLevel;
    salesLevel?: AccountLevel;
    contentLevel?: AccountLevel;
    commerceLevel?: AccountLevel;
  } = {},
  supportFlags: boolean = true
): Promise<DeveloperTestAccountConfig> {
  const hasAnyTierLevels = !!(
    args.marketingLevel ||
    args.opsLevel ||
    args.serviceLevel ||
    args.salesLevel ||
    args.contentLevel ||
    args.commerceLevel
  );

  const result = await promptUser<{
    accountName?: string;
    description?: string;
  }>([
    {
      name: 'accountName',
      message:
        lib.prompts.createDeveloperTestAccountConfigPrompt.namePrompt(
          supportFlags
        ),
      type: 'input',
      when: !args.name,
      validate: value => {
        if (!value) {
          return lib.prompts.createDeveloperTestAccountConfigPrompt.errors
            .nameRequired;
        }
        return true;
      },
    },
    {
      name: 'description',
      message:
        lib.prompts.createDeveloperTestAccountConfigPrompt.descriptionPrompt(
          supportFlags
        ),
      type: 'input',
      when: !args.description,
    },
  ]);

  const accountName = args.name || result.accountName!;
  const description = args.description || result.description;

  let accountLevels: { [key in HubLevelKey]?: AccountLevel } = {};

  if (hasAnyTierLevels) {
    accountLevels = {
      marketingLevel: args.marketingLevel || AccountTiers.ENTERPRISE,
      opsLevel: args.opsLevel || AccountTiers.ENTERPRISE,
      serviceLevel: args.serviceLevel || AccountTiers.ENTERPRISE,
      salesLevel: args.salesLevel || AccountTiers.ENTERPRISE,
      contentLevel: args.contentLevel || AccountTiers.ENTERPRISE,
      commerceLevel: args.commerceLevel || AccountTiers.ENTERPRISE,
    };
  } else {
    const tierChoiceResult = await promptUser<{
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

    if (tierChoiceResult.useDefaultAccountLevels === 'default') {
      accountLevels = {
        marketingLevel: AccountTiers.ENTERPRISE,
        opsLevel: AccountTiers.ENTERPRISE,
        serviceLevel: AccountTiers.ENTERPRISE,
        salesLevel: AccountTiers.ENTERPRISE,
        contentLevel: AccountTiers.ENTERPRISE,
        commerceLevel: AccountTiers.ENTERPRISE,
      };
    } else {
      const tierResult = await promptUser<{ testAccountLevels: HubConfig[] }>({
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
          }
          const hubMap: Record<string, boolean> = {};
          for (const choice of choices) {
            const { hub } = choice.value;
            if (hubMap[hub]) {
              return lib.prompts.createDeveloperTestAccountConfigPrompt.errors
                .tiersError;
            }
            hubMap[hub] = true;
          }
          return true;
        },
      });

      accountLevels = tierResult.testAccountLevels.reduce<{
        [key in HubLevelKey]?: AccountLevel;
      }>((acc, level) => {
        const { hub: hubName, tier: hubTier } = level;
        const hubLevel = hubs[hubName];
        acc[hubLevel] = hubTier;
        return acc;
      }, {});
    }
  }

  return {
    accountName,
    description,
    ...accountLevels,
  };
}
