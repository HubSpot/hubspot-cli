import { prefixOptions } from '../ui/spinniesUtils';
import { bold, green, red } from 'chalk';
import { orange } from '../interpolationHelpers';
import { DiagnosticInfo } from './DiagnosticInfoBuilder';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPE_STRINGS } from '@hubspot/local-dev-lib/constants/config';

const { i18n } = require('../lang');

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

const i18nKey = `lib.doctor.diagnosis`;

export class Diagnosis {
  private readonly prefixes: prefixes;
  private readonly diagnosis: DiagnosisCategories;
  private readonly indentation = '  ';
  errorCount = 0;
  warningCount = 0;

  constructor({ diagnosticInfo, accountId }: DiagnosisOptions) {
    // @ts-expect-error Prefix options is not typed yet
    const { succeedPrefix, failPrefix } = prefixOptions({});

    const { accountType, name: accountName } =
      getAccountConfig(accountId!) || {};

    this.prefixes = {
      success: green(succeedPrefix),
      error: red(failPrefix),
      warning: orange('!'),
    };

    this.diagnosis = {
      cli: {
        header: i18n(`${i18nKey}.cli.header`),
        sections: [],
      },
      cliConfig: {
        header: i18n(`${i18nKey}.cliConfig.header`),
        subheaders: [
          i18n(`${i18nKey}.cliConfig.configFileSubHeader`, {
            filename: diagnosticInfo.config,
          }),
          i18n(`${i18nKey}.cliConfig.defaultAccountSubHeader`, {
            accountName,
            accountType: HUBSPOT_ACCOUNT_TYPE_STRINGS[accountType!],
            accountId,
          }),
        ],
        sections: [],
      },
      project: {
        header: i18n(`${i18nKey}.projectConfig.header`),
        subheaders: [
          i18n(`${i18nKey}.projectConfig.projectDirSubHeader`, {
            projectDir: diagnosticInfo.project.config?.projectDir,
          }),
          i18n(`${i18nKey}.projectConfig.projectNameSubHeader`, {
            projectName: diagnosticInfo.project.config?.projectConfig?.name,
          }),
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
    output.push(
      i18n(`${i18nKey}.counts.errors`, {
        count: this.errorCount,
      })
    );
    output.push(
      i18n(`${i18nKey}.counts.warnings`, {
        count: this.warningCount,
      })
    );
    output.push('');

    return output.join('\n');
  }

  private generateSections(category: DiagnosisCategory) {
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
