import {
  getSuccessBox,
  getInfoBox,
  getWarningBox,
  getAlertBox,
} from '../components/StatusMessageBoxes.js';
import { getBoxWithTitle } from '../components/BoxWithTitle.js';
import { getTable } from '../components/Table.js';
import {
  SuccessBox,
  InfoBox,
  WarningBox,
  AlertBox,
} from '../components/StatusMessageBoxes.js';
import { BoxWithTitle } from '../components/BoxWithTitle.js';

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
};

export function getComponentOptions(): string[] {
  return Object.keys(populatedComponents);
}
