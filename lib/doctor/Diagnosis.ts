import { prefixOptions } from '../ui/spinniesUtils';
import { bold, cyan, green, red } from 'chalk';
import { orange } from '../interpolationHelpers';
import { DiagnosticInfo } from './DiagnosticInfo';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPE_STRINGS } from '@hubspot/local-dev-lib/constants/config';

interface DiagnosisOptions {
  diagnosticInfo: DiagnosticInfo;
  accountId: number | null;
}

interface Section {
  type: 'error' | 'warning' | 'success';
  message: string;
  secondaryMessaging?: string;
}

type prefixes = {
  [prefix in Section['type']]: string;
};

interface DiagnosisCategory {
  header: string;
  subheaders?: string[];
  sections: Section[];
}

interface DiagnosisCategories {
  cli: DiagnosisCategory;
  project: DiagnosisCategory;
  cliConfig: DiagnosisCategory;
}

export class Diagnosis {
  private readonly prefixes: prefixes;
  private readonly diagnosis: DiagnosisCategories;
  private readonly indentation = '  ';
  errorCount = 0;
  warningCount = 0;

  constructor({ diagnosticInfo, accountId }: DiagnosisOptions) {
    // @ts-expect-error Prefix options is not typed yet
    const { succeedPrefix, failPrefix } = prefixOptions({});

    const { accountType } = getAccountConfig(accountId!) || {};

    this.prefixes = {
      success: green(succeedPrefix),
      error: red(failPrefix),
      warning: orange('!'),
    };

    this.diagnosis = {
      cli: {
        header: 'HubSpot CLI install',
        sections: [],
      },
      cliConfig: {
        header: 'CLI configuration',
        subheaders: [
          `Config File: ${cyan(diagnosticInfo.config)}`,
          `Default Account: ${cyan(
            `name [${HUBSPOT_ACCOUNT_TYPE_STRINGS[accountType!]}](${accountId})`
          )}`,
        ],
        sections: [],
      },
      project: {
        header: 'Project configuration',
        subheaders: [
          `Project dir: ${cyan(diagnosticInfo.project.config?.projectDir)}`,
          `Project name: ${cyan(
            diagnosticInfo.project.config?.projectConfig?.name
          )}`,
        ],
        sections: [],
      },
    };
  }

  private indent(level: number) {
    return this.indentation.repeat(level);
  }

  addCliSection(section: Section) {
    this.diagnosis.cli.sections.push(section);
  }

  addProjectSection(section: Section) {
    this.diagnosis.project.sections.push(section);
  }

  addCLIConfigSection(section: Section) {
    this.diagnosis.cliConfig.sections.push(section);
  }

  toString() {
    const output = [];
    for (const value of Object.values(this.diagnosis)) {
      output.push(this.generateSections(value));
    }

    output.push('');
    output.push(`${bold('Errors')}:   ${this.errorCount}`);
    output.push(`${bold('Warnings')}: ${this.warningCount}`);
    output.push('');

    return output.join('\n');
  }

  generateSections(category: DiagnosisCategory) {
    const output = [];

    if (category.sections && category.sections.length === 0) {
      return '';
    }

    output.push(`\n${bold(category.header)}`);

    (category.subheaders || []).forEach(subheader => {
      output.push(`${subheader}`);
    });

    category.sections.forEach(section => {
      if (section.type === 'error') {
        this.errorCount++;
      } else if (section.type === 'warning') {
        this.warningCount++;
      }

      output.push(
        `${this.indent(1)}${this.prefixes[section.type]} ${section.message}`
      );
      if (section.secondaryMessaging) {
        output.push(`${this.indent(2)}- ${section.secondaryMessaging}`);
      }
    });

    return output.join('\n');
  }
}
