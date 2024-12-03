export type GenericPromptResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

type PromptType = 'confirm' | 'list' | 'checkbox' | 'input' | 'password';

export type PromptChoices = string[] | Array<{ name: string; value: string }>;

export type PromptWhen = boolean | (() => boolean);

type PromptOperand = string | number | boolean | string[] | boolean[];

export type PromptConfig<T extends GenericPromptResponse> = {
  name: keyof T;
  type?: PromptType;
  message?: string;
  choices?: PromptChoices;
  when?: PromptWhen;
  pageSize?: number;
  default?: PromptOperand;
  validate?:
    | ((answer?: string) => PromptOperand | Promise<PromptOperand>)
    | ((answer: string[]) => PromptOperand | Promise<PromptOperand>);
  mask?: string;
  filter?: (input: string) => string;
};
