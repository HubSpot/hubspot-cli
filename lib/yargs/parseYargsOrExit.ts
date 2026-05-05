import { ArgumentsCamelCase, Argv } from 'yargs';

type YargsFailureHandler<T> = (
  message: string | null,
  error: unknown,
  parser: Argv<T>
) => never;

function getYargsErrorMessage(error: unknown): string {
  return error instanceof Error && error.name === 'YError' ? error.message : '';
}

function getYargsFailureMessage(
  message: string | null,
  error: unknown
): string | null {
  if (message) {
    return message;
  }

  return getYargsErrorMessage(error) || message;
}

export async function parseYargsOrExit<T>(
  parser: Argv<T>,
  handleFailure: YargsFailureHandler<T>
): Promise<ArgumentsCamelCase<T>> {
  let failureHandled = false;

  const parserWithFailureHandler = parser.fail((message, error, yargs) => {
    failureHandled = true;
    return handleFailure(
      getYargsFailureMessage(message, error),
      error,
      yargs as Argv<T>
    );
  });

  try {
    return await parserWithFailureHandler.parseAsync();
  } catch (error) {
    if (failureHandled) {
      throw error;
    }

    return handleFailure(
      getYargsErrorMessage(error),
      error,
      parserWithFailureHandler
    );
  }
}
