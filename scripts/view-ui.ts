import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { render } from 'ink';
import { getUiSandbox } from '../ui/views/UiSandbox.js';

type ViewUiArgs = {
  componentName?: string;
};

async function handler({
  componentName,
}: ArgumentsCamelCase<ViewUiArgs>): Promise<void> {
  render(getUiSandbox({ componentName }));
}

async function builder(yargs: Argv): Promise<Argv> {
  return yargs.options({
    componentName: {
      alias: 'c',
      describe: 'Component to view',
      type: 'string',
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs(process.argv.slice(2))
  .scriptName('view-ui')
  .usage('View the UI for a component')
  .command('$0', 'View the UI for a component', builder, handler)
  .version(false)
  .help().argv;
