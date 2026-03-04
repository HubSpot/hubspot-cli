import {
  getSuccessBox,
  getInfoBox,
  getWarningBox,
  getAlertBox,
} from '../components/StatusMessageBoxes.js';
import { getBoxWithTitle } from '../components/BoxWithTitle.js';
import { getTable } from '../components/Table.js';
import { getActionSection } from '../components/ActionSection.js';
import { getInputField } from '../components/InputField.js';
import { getSelectInput } from '../components/SelectInput.js';
import { getStatusIcon } from '../components/StatusIcon.js';
import {
  SuccessBox,
  InfoBox,
  WarningBox,
  AlertBox,
} from '../components/StatusMessageBoxes.js';
import { BoxWithTitle } from '../components/BoxWithTitle.js';
import { ActionSection } from '../components/ActionSection.js';
import { InputField } from '../components/InputField.js';
import { SelectInput } from '../components/SelectInput.js';
import { StatusIcon } from '../components/StatusIcon.js';
import { ACTION_STATUSES } from '../constants.js';
import { Text } from 'ink';

export type ComponentPropPair = {
  component: React.ReactNode;
  signature: string;
};

/**
 * These components will be used by the playground. Please add any new components here.
 */
export const populatedComponents: Record<string, ComponentPropPair> = {
  SuccessBox: {
    component: getSuccessBox({
      title: 'Success',
      message: 'This is a success message',
    }),
    signature: SuccessBox.toString(),
  },
  InfoBox: {
    component: getInfoBox({
      title: 'Info',
      message: 'This is an info message',
    }),
    signature: InfoBox.toString(),
  },
  WarningBox: {
    component: getWarningBox({
      title: 'Warning',
      message: 'This is a warning message',
    }),
    signature: WarningBox.toString(),
  },
  AlertBox: {
    component: getAlertBox({
      title: 'Alert',
      message: 'This is an alert message',
    }),
    signature: AlertBox.toString(),
  },
  BoxWithTitle: {
    component: getBoxWithTitle({
      title: 'Title',
      message: 'This is a box with a title',
    }),
    signature: BoxWithTitle.toString(),
  },
  Table: {
    component: getTable({
      data: [
        {
          name: 'Sosa Saunders',
          gender: 'male',
          company: 'VALREDA',
          email: 'sosasaunders@valreda.com',
          phone: '+1 (809) 435-2786',
          address: 'Nautilus Avenue, Bentonville, Alabama, 927',
        },
        {
          name: 'Angelina Kirk',
          gender: 'female',
          company: 'ZENTILITY',
          email: 'angelinakirk@zentility.com',
          phone: '+1 (870) 567-3516',
          address: 'Corbin Place, Stevens, Nevada, 6268',
        },
        {
          name: 'Bradford Rosales',
          gender: 'male',
          company: 'HYDROCOM',
          email: 'bradfordrosales@hydrocom.com',
          phone: '+1 (918) 573-3240',
          address: 'Troy Avenue, Martinez, Oklahoma, 1402',
        },
      ],
    }),
    signature: '',
  },
  ActionSection: {
    component: getActionSection({
      status: ACTION_STATUSES.DONE,
      statusText: 'Action completed successfully',
      children: <Text>This is an action section</Text>,
    }),
    signature: ActionSection.toString(),
  },
  InputField: {
    component: getInputField({
      flag: 'name',
      prompt: 'Enter your name',
      value: 'example',
      isEditing: false,
      onChange: () => {},
      onSubmit: () => {},
    }),
    signature: InputField.toString(),
  },
  SelectInput: {
    component: getSelectInput({
      items: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
      onSelect: () => {},
    }),
    signature: SelectInput.toString(),
  },
  StatusIcon: {
    component: getStatusIcon({
      status: ACTION_STATUSES.DONE,
    }),
    signature: StatusIcon.toString(),
  },
};

export function getComponentOptions(): string[] {
  return Object.keys(populatedComponents);
}
