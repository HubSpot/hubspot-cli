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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PromptChoices<T = any> = Array<
  | string
  | {
      name: string;
      value?: T;
      disabled?: string | boolean;
    }
>;

export type PromptWhen = boolean | (() => boolean);

type PromptOperand = string | number | boolean | string[] | boolean[] | null;

export type PromptConfig<T extends GenericPromptResponse> = {
  name: keyof T;
  type?: PromptType;
  message?: string | ((answers: T) => string);
  choices?: PromptChoices;
  when?: PromptWhen;
  pageSize?: number;
  default?: PromptOperand | ((answers: T) => PromptOperand);
  transformer?: (input: string) => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate?: (answer?: any) => PromptOperand | Promise<PromptOperand>;
  mask?: string;
  filter?: (input: string) => string;
};
