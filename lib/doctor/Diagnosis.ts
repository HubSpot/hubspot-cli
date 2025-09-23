import { prefixOptions } from '../ui/spinniesUtils.js';
import chalk from 'chalk';
import { helpers } from '../interpolation.js';
import { DiagnosticInfo } from './DiagnosticInfoBuilder.js';
import { uiAccountDescription } from '../ui/index.js';
import { indent } from '../ui/index.js';
import { i18n } from '../lang.js';

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
  defaultAccountOverrideFile: DiagnosisCategory;
}

export class Diagnosis {
  private readonly prefixes: prefixes;
  private readonly diagnosis: DiagnosisCategories;
  private errorCount = 0;
  private warningCount = 0;

  constructor({ diagnosticInfo, accountId }: DiagnosisOptions) {
    const { succeedPrefix, failPrefix } = prefixOptions({});

    this.prefixes = {
      success: chalk.green(succeedPrefix),
      error: chalk.red(failPrefix),
      warning: helpers.orange('!'),
    };

    this.diagnosis = {
      cli: {
        header: i18n(`lib.doctor.diagnosis.cli.header`),
        sections: [],
      },
      cliConfig: {
        header: i18n(`lib.doctor.diagnosis.cliConfig.header`),
        sections: [],
      },
      defaultAccountOverrideFile: {
        header: i18n(`lib.doctor.diagnosis.defaultAccountOverrideFile.header`),
        sections: [],
      },
      project: {
        header: i18n(`lib.doctor.diagnosis.projectConfig.header`),
        subheaders: [
          i18n(`lib.doctor.diagnosis.projectConfig.projectDirSubHeader`, {
            projectDir: diagnosticInfo.project?.config?.projectDir,
          }),
          i18n(`lib.doctor.diagnosis.projectConfig.projectNameSubHeader`, {
            projectName: diagnosticInfo.project?.config?.projectConfig?.name,
          }),
        ],
        sections: [],
      },
    };

    if (diagnosticInfo.config) {
      this.diagnosis.cliConfig.subheaders = [
        i18n(`lib.doctor.diagnosis.cliConfig.configFileSubHeader`, {
          filename: diagnosticInfo.config,
        }),
        i18n(`lib.doctor.diagnosis.cliConfig.defaultAccountSubHeader`, {
          accountDetails: uiAccountDescription(accountId!),
        }),
      ];
    }
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getWarningCount(): number {
    return this.warningCount;
  }

  addCliSection(section: Section): void {
    this.diagnosis.cli.sections.push(section);
  }

  addProjectSection(section: Section): void {
    this.diagnosis.project.sections.push(section);
  }

  addCLIConfigSection(section: Section): void {
    this.diagnosis.cliConfig.sections.push(section);
  }

  addDefaultAccountOverrideFileSection(section: Section): void {
    this.diagnosis.defaultAccountOverrideFile.sections.push(section);
  }

  toString(): string {
    const output = [];
    for (const value of Object.values(this.diagnosis)) {
      const section = this.generateSections(value);
      if (section) {
        output.push(section);
      }
    }

    if (output.length === 0) {
      return '';
    }

    output.push('');
    output.push(
      i18n(`lib.doctor.diagnosis.counts.errors`, {
        count: this.errorCount,
      })
    );
    output.push(
      i18n(`lib.doctor.diagnosis.counts.warnings`, {
        count: this.warningCount,
      })
    );
    output.push('');

    return output.join('\n');
  }

  private generateSections(category: DiagnosisCategory): string {
    const output = [];

    if (category.sections && category.sections.length === 0) {
      return '';
    }

    output.push(`\n${chalk.bold(category.header)}`);

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
        `${indent(1)}${this.prefixes[section.type]} ${section.message}`
      );
      if (section.secondaryMessaging) {
        output.push(`${indent(2)}- ${section.secondaryMessaging}`);
      }
    });

    return output.join('\n');
  }
}
