import path from 'path';
import { Box, Text } from 'ink';
import { APP_KEY as AppKey } from '@hubspot/project-parsing-lib/constants';
import { type ProjectMetadata } from '@hubspot/project-parsing-lib/projects';
import { commands } from '../../../../lang/en.js';
import { type AppIRNode } from '../../../../lib/getStartedV2Actions.js';
import {
  buildProjectTree,
  ComponentsByType,
} from '../../../../lib/projects/components.js';
import { ActionSection } from '../../ActionSection.js';
import { BoxWithTitle } from '../../BoxWithTitle.js';
import { INK_COLORS } from '../../../styles.js';
import { FlowState } from '../reducer.js';
import { getProject } from '../selectors.js';
import { ACTION_STATUSES } from '../../../lib/constants.js';

function renderProjectTree(
  projectName: string,
  app: AppIRNode,
  projectMetadata: ProjectMetadata
): React.ReactNode {
  const componentsByType: ComponentsByType = new Map();
  const uids: string[] = [];

  // Get app UID
  uids.push(app.uid || app.config?.name || 'unknown');

  // Build componentsByType from projectMetadata
  Object.entries(projectMetadata.components).forEach(
    ([componentType, metadata]) => {
      if (componentType === AppKey || !metadata?.hsMetaFiles) return;

      const components = metadata.hsMetaFiles.map((filePath: string) => ({
        filename: path.basename(filePath),
        isNew: false,
      }));

      if (components.length > 0) {
        componentsByType.set(componentType, components);
      }
    }
  );

  const tree = buildProjectTree(projectName, uids, componentsByType, false);

  return (
    <Box flexDirection="column">
      {tree.split('\n').map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}

type UploadScreenProps = {
  state: FlowState;
  accountName: string;
};

export function UploadScreen({ state, accountName }: UploadScreenProps) {
  const project = getProject(state);

  const titleText = commands.getStarted.v2.startTitle;
  const uploadingProjectText = commands.getStarted.v2.uploadingProject;

  return (
    <BoxWithTitle
      flexGrow={1}
      title="hs get-started"
      borderColor={INK_COLORS.HUBSPOT_ORANGE}
      titleBackgroundColor={INK_COLORS.HUBSPOT_ORANGE}
    >
      <Box flexDirection="column" rowGap={1}>
        <Text bold>{titleText}</Text>

        <ActionSection
          status={state.statuses.upload}
          statusText={uploadingProjectText}
          errorMessage={
            state.statuses.upload === ACTION_STATUSES.ERROR
              ? `${state.error}\n\n${commands.getStarted.v2.pressKeyToExit}`
              : undefined
          }
        />

        {state.statuses.upload === ACTION_STATUSES.DONE &&
          project.uploadResult?.projectName && (
            <>
              <Text>{commands.getStarted.v2.appDeployedReady}</Text>

              {project.uploadResult.app &&
                project.uploadResult.projectMetadata && (
                  <Box flexDirection="column" rowGap={1}>
                    {renderProjectTree(
                      project.uploadResult.projectName,
                      project.uploadResult.app,
                      project.uploadResult.projectMetadata
                    )}

                    <Box flexDirection="column">
                      <Text>{commands.getStarted.v2.appConfigDetails}</Text>
                      <Box flexDirection="column" paddingLeft={2}>
                        <Box flexDirection="row" columnGap={1}>
                          <Text bold>
                            {commands.getStarted.v2.distribution}
                          </Text>
                          <Text>→</Text>
                          <Text>
                            {project.uploadResult.app.config?.distribution ||
                              'private'}
                          </Text>
                        </Box>
                        <Box flexDirection="row" columnGap={1}>
                          <Text bold>{commands.getStarted.v2.authType}</Text>
                          <Text>→</Text>
                          <Text>
                            {project.uploadResult.app.config?.auth?.type ||
                              'static'}
                          </Text>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}

              {project.uploadResult.projectDir && (
                <Text>
                  {commands.getStarted.v2.checkOutConfig(
                    `${project.uploadResult.projectDir}/src/app/app-hsmeta.json`
                  )}
                </Text>
              )}

              <Text>
                {commands.getStarted.v2.pressEnterToInstall(accountName)}
              </Text>
            </>
          )}
      </Box>
    </BoxWithTitle>
  );
}
