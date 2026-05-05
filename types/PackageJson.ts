/**
 * Represents the structure of a package.json file.
 */
export interface PackageJson {
  name: string;
  version?: string;
  workspaces?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
