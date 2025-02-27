// These types are for Unified Apps and projects on platform version 2025.1 and above

import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';
import {
  IR_COMPONENT_TYPES,
  APP_DISTRIBUTION_TYPES,
  APP_AUTH_TYPES,
} from '../lib/constants';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';

type AppDistributionType = ValueOf<typeof APP_DISTRIBUTION_TYPES>;
type AppAuthType = ValueOf<typeof APP_AUTH_TYPES>;

type AppConfig = {
  description: string;
  name: string;
  logo: string;
  distribution: AppDistributionType;
  auth: {
    type: AppAuthType;
    redirectUrls: string[];
    requiredScopes: string[];
    optionalScopes: string[];
    conditionallyRequiredScopes: string[];
  };
};

type CardConfig = {
  name: string;
  description: string;
  previewImage: {
    file: string;
    altText: string;
  };
  entrypoint: string;
  location: string;
  objectTypes: string[];
};

export interface AppIRNode extends IntermediateRepresentationNodeLocalDev {
  componentType: typeof IR_COMPONENT_TYPES.APPLICATION;
  config: AppConfig;
}

export interface CardIRNode extends IntermediateRepresentationNodeLocalDev {
  componentType: typeof IR_COMPONENT_TYPES.CARD;
  config: CardConfig;
}
