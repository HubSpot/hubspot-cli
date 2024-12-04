import { DeveloperTestAccount } from '@hubspot/local-dev-lib/types/developerTestAccounts';

export type GenericPromptResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

type PromptType =
  | 'confirm'
  | 'list'
  | 'checkbox'
  | 'input'
  | 'password'
  | 'number'
  | 'rawlist';

export type PromptChoices = Array<
  | string
  | {
      name: string;
      value:
        | string
        | {
            [key: string]:
              | string
              | number
              | boolean
              | DeveloperTestAccount
              | null;
          };
      disabled?: string | boolean;
    }
>;

export type PromptWhen = boolean | (() => boolean);

export type PromptOperand = string | number | boolean | string[] | boolean[];

export type PromptConfig<T extends GenericPromptResponse> = {
  name: keyof T;
  type?: PromptType;
  message?: string | ((answers: T) => string);
  choices?: PromptChoices;
  when?: PromptWhen;
  pageSize?: number;
  default?: PromptOperand | ((answers: T) => PromptOperand);
  transformer?: (input: string) => string | undefined;
  validate?:
    | ((answer?: string) => PromptOperand | Promise<PromptOperand>)
    | ((answer?: number) => PromptOperand | Promise<PromptOperand>)
    | ((answer: string[]) => PromptOperand | Promise<PromptOperand>);
  mask?: string;
  filter?: (input: string) => string;
};
