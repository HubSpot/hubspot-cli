import { Box, Text } from 'ink';
import { commands } from '../../../../lang/en.js';
import { ActionSection } from '../../ActionSection.js';
import { BoxWithTitle } from '../../BoxWithTitle.js';
import { INK_COLORS } from '../../../styles.js';
import { FlowState } from '../reducer.js';
import { getProject } from '../selectors.js';
import {
  ACTION_STATUSES,
  GET_STARTED_FLOW_STEPS,
} from '../../../lib/constants.js';

type InstallationScreenProps = {
  state: FlowState;
  accountName: string;
};

export function InstallationScreen({
  state,
  accountName,
}: InstallationScreenProps) {
  const project = getProject(state);

  const titleText = commands.getStarted.v2.startTitle;

  // If we get to the installation screen, the app is uploaded and we have the name
  const appName = project.uploadResult?.app?.config.name as string;

  return (
    <BoxWithTitle
      flexGrow={1}
      title="hs get-started"
      borderColor={INK_COLORS.HUBSPOT_ORANGE}
      titleBackgroundColor={INK_COLORS.HUBSPOT_ORANGE}
    >
      <Box flexDirection="column" rowGap={1}>
        <Text bold>{titleText}</Text>

        <Text>{commands.getStarted.v2.installInstructions}</Text>

        <ActionSection
          status={state.statuses.installApp}
          statusText={commands.getStarted.v2.installingApp(
            appName,
            accountName
          )}
        />

        {state.browserFailedUrl && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={INK_COLORS.WARNING_YELLOW}>
              {commands.getStarted.v2.browserFailedToOpen(
                state.browserFailedUrl
              )}
            </Text>
          </Box>
        )}

        {state.pollingTimedOut && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={INK_COLORS.WARNING_YELLOW}>
              {commands.getStarted.v2.pollingTimeout(2)}
            </Text>
          </Box>
        )}

        {state.step === GET_STARTED_FLOW_STEPS.INSTALLING_APP &&
          state.statuses.installApp === ACTION_STATUSES.DONE && (
            <Text>{commands.getStarted.v2.pressEnterToContinueSetup}</Text>
          )}
      </Box>
    </BoxWithTitle>
  );
}
