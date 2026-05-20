import path from 'path';
import { runNpmAuditJson } from '@hubspot/ui-extensions-dev-server';
import type { ParsedPackageJson } from '@hubspot/project-parsing-lib/workspaces';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

type NpmAuditVulnerabilities = {
  info?: number;
  low?: number;
  moderate?: number;
  high?: number;
  critical?: number;
  total?: number;
};

type NpmAuditJsonShape = {
  metadata?: { vulnerabilities?: NpmAuditVulnerabilities };
  error?: { message?: string; summary?: string };
};

export function summarizeNpmAuditJson(source: string): string | null {
  try {
    const data = JSON.parse(source) as NpmAuditJsonShape;
    const errorMessage = data.error?.message ?? data.error?.summary;
    if (errorMessage) {
      return errorMessage;
    }
    const v = data.metadata?.vulnerabilities;
    if (!v) {
      return null;
    }
    const total = v.total ?? 0;
    if (total === 0) {
      return null;
    }
    const severityOrder = [
      'critical',
      'high',
      'moderate',
      'low',
      'info',
    ] as const;
    const parts = severityOrder
      .filter(severity => (v[severity] ?? 0) > 0)
      .map(severity => `${v[severity]} ${severity}`);
    return `${total} total (${parts.join(', ')})`;
  } catch {
    return null;
  }
}

type RunNpmAuditsBeforeProjectUploadArgs = {
  srcDir: string;
  projectDir: string;
  parsedPackageJsons: ParsedPackageJson[];
  isLegacyPlatform: boolean;
};

export async function runNpmAuditsBeforeProjectUpload({
  srcDir,
  projectDir,
  parsedPackageJsons,
  isLegacyPlatform,
}: RunNpmAuditsBeforeProjectUploadArgs): Promise<void> {
  const auditRoots = new Set<string>();
  if (isLegacyPlatform) {
    auditRoots.add(srcDir);
  } else {
    for (const { dir } of parsedPackageJsons) {
      auditRoots.add(dir);
    }
    if (auditRoots.size === 0) {
      auditRoots.add(srcDir);
    }
  }

  const auditRootArray = [...auditRoots];
  const results = await Promise.all(
    auditRootArray.map(auditRoot => runNpmAuditJson(auditRoot))
  );

  for (let i = 0; i < auditRootArray.length; i++) {
    const auditRoot = auditRootArray[i];
    const result = results[i];

    if (result.skipped) {
      continue;
    }

    const relativeRoot = path.relative(projectDir, auditRoot) || '.';
    const summary = summarizeNpmAuditJson(result.source);

    if (result.exitCode === 127) {
      uiLogger.warn(
        lib.projectUpload.handleProjectUpload.npmAuditNpmUnavailable(
          relativeRoot
        )
      );
      continue;
    }

    if (summary) {
      uiLogger.warn(
        lib.projectUpload.handleProjectUpload.npmAuditIssues(
          relativeRoot,
          summary
        )
      );
      continue;
    }

    if (result.exitCode !== 0) {
      uiLogger.warn(
        lib.projectUpload.handleProjectUpload.npmAuditNonZeroExit(
          relativeRoot,
          result.exitCode
        )
      );
      continue;
    }

    uiLogger.success(
      lib.projectUpload.handleProjectUpload.npmAuditClean(relativeRoot)
    );
  }
}
