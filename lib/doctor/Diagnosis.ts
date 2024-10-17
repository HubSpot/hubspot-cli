import { prefixOptions } from '../ui/spinniesUtils';
import { bold, cyan, green, red } from 'chalk';
import { orange } from '../interpolationHelpers';

interface DiagnosisOptions {
  configFilePath: string;
  defaultAccount: string;
  projectDir: string;
  projectName: string;
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
  private prefixes: prefixes;
  private readonly diagnosis: DiagnosisCategories;

  constructor({
    configFilePath,
    defaultAccount,
    projectDir,
    projectName,
  }: DiagnosisOptions) {
    const { succeedPrefix, failPrefix } = prefixOptions({} as any);

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
          `Project dir: ${cyan(projectDir)}`,
          `Project name: ${cyan(projectName)}`,
        ],
        sections: [],
      },
      project: {
        header: 'Project configuration',
        subheaders: [
          `Project dir: ${cyan(projectDir)}`,
          `Project name: ${cyan(projectName)}`,
        ],
        sections: [],
      },
    };
  }

  addCliSection(section: Section) {
    this.diagnosis.cli.sections.push(section);
  }

  addProjectSection(section: Section) {
    this.diagnosis.project.sections.push(section);
  }

  addCLIConfigError(section: Section) {
    this.diagnosis.cliConfig.sections.push(section);
  }

  toString() {
    const output = [];
    for (const [__key, value] of Object.entries(this.diagnosis)) {
      output.push(this.generateSections(value));
    }

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
      output.push(`  ${this.prefixes[section.type]} ${section.message}`);
      if (section.secondaryMessaging) {
        output.push(`  - ${section.secondaryMessaging}`);
      }
    });

    return output.join('\n');
  }
}
