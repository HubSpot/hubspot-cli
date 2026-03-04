import { Box, Text } from 'ink';
import { commands } from '../../../../lang/en.js';
import { GET_STARTED_OPTIONS } from '../../../../lib/constants.js';
import { ActionSection } from '../../ActionSection.js';
import { BoxWithTitle } from '../../BoxWithTitle.js';
import { InputField } from '../../InputField.js';
import { SelectInput, SelectInputItem } from '../../SelectInput.js';
import { INK_COLORS } from '../../../styles.js';
import { FlowState } from '../reducer.js';
import { getProject } from '../selectors.js';
import {
  ACTION_STATUSES,
  GET_STARTED_FLOW_STEPS,
} from '../../../lib/constants.js';

export const GET_STARTED_FLOW_OPTIONS: SelectInputItem[] = [
  {
    label: commands.getStarted.prompts.options.app,
    value: GET_STARTED_OPTIONS.APP,
  },
  {
    label: commands.getStarted.prompts.options.cmsTheme,
    value: 'CMS_THEME',
    disabled: true,
  },
  {
    label: commands.getStarted.prompts.options.cmsReactModule,
    value: 'CMS_REACT_MODULE',
    disabled: true,
  },
];

type ProjectSetupScreenProps = {
  state: FlowState;
  onSelectOption: (item: { label: string; value: string }) => void;
  onNameChange: (value: string) => void;
  onNameSubmit: () => void;
  onDestChange: (value: string) => void;
  onDestSubmit: () => void;
};

export function ProjectSetupScreen({
  state,
  onSelectOption,
  onNameChange,
  onNameSubmit,
  onDestChange,
  onDestSubmit,
}: ProjectSetupScreenProps) {
  const project = getProject(state);

  const titleText = commands.getStarted.v2.startTitle;
  const overviewText = commands.getStarted.v2.guideOverview(
    state.app.selectedLabel
  );
  const projectsText = commands.getStarted.v2.projects;
  const selectPrompt = commands.getStarted.v2.prompts.selectOptionV2;
  const runningProjectCreateText = commands.getStarted.v2.runningProjectCreate;

  return (
    <BoxWithTitle
      flexGrow={1}
      title="hs get-started"
      borderColor={INK_COLORS.HUBSPOT_ORANGE}
      titleBackgroundColor={INK_COLORS.HUBSPOT_ORANGE}
    >
      <Box flexDirection="column" rowGap={1}>
        <Text bold>{titleText}</Text>

        {state.step === GET_STARTED_FLOW_STEPS.SELECT ? (
          <>
            <Text>{overviewText}</Text>
            <Text>{projectsText}</Text>
            <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Text color={INK_COLORS.HUBSPOT_TEAL}>?</Text>
              <Text>{selectPrompt}</Text>
            </Box>
            <SelectInput
              items={GET_STARTED_FLOW_OPTIONS}
              onSelect={onSelectOption}
            />
          </>
        ) : (
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Text color={INK_COLORS.HUBSPOT_TEAL}>?</Text>
            <Text>{`${selectPrompt}`}</Text>
            <Text color={INK_COLORS.INFO_BLUE}>{state.app.selectedLabel}</Text>
          </Box>
        )}

        <ActionSection
          status={state.statuses.create}
          statusText={runningProjectCreateText}
          errorMessage={
            state.statuses.create === ACTION_STATUSES.ERROR
              ? `${state.error}\n\n${commands.getStarted.v2.pressKeyToExit}`
              : undefined
          }
        >
          {state.step !== GET_STARTED_FLOW_STEPS.SELECT && (
            <InputField
              flag="name"
              prompt="Enter your project name"
              value={project.name}
              isEditing={state.step === GET_STARTED_FLOW_STEPS.NAME_INPUT}
              onChange={onNameChange}
              onSubmit={onNameSubmit}
            />
          )}

          {state.step !== GET_STARTED_FLOW_STEPS.SELECT &&
            state.step !== GET_STARTED_FLOW_STEPS.NAME_INPUT && (
              <>
                <InputField
                  flag="dest"
                  prompt="Choose where to create the project"
                  value={project.destination}
                  isEditing={state.step === GET_STARTED_FLOW_STEPS.DEST_INPUT}
                  onChange={onDestChange}
                  onSubmit={onDestSubmit}
                />
                {state.destError &&
                  state.step === GET_STARTED_FLOW_STEPS.DEST_INPUT && (
                    <Text color={INK_COLORS.ALERT_RED}>{state.destError}</Text>
                  )}
              </>
            )}
        </ActionSection>

        {state.step === GET_STARTED_FLOW_STEPS.COMPLETE && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Text color={INK_COLORS.HUBSPOT_TEAL}>?</Text>
            <Text>
              {commands.getStarted.v2.pressEnterToContinueDeploy(
                state.app.selectedLabel
              )}
            </Text>
          </Box>
        )}
      </Box>
    </BoxWithTitle>
  );
}
