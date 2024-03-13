import path from "node:path";
import fs from "node:fs";
import module from "node:module";
import assert from "node:assert";

import chalk from "chalk";
import createDebug from "debug";
import binaryExtensions from "binary-extensions";
import { globbyStream } from "globby";

const debug = createDebug("resolve-node-modules");

/**
 * Implements a simplified version of the node_modules resolution algorithm
 */
export function simpleNodeResolve(modulePath: string, from: string): string {
  debug("Resolving", modulePath, "from", from);
  const moduleDirectory = path.dirname(modulePath);
  const moduleFilenamePrefix = path.basename(modulePath);

  const nodeModulePaths = module.createRequire(from).resolve.paths(modulePath);
  if (!nodeModulePaths) {
    throw new Error(`Failed to determine paths when resolving '${modulePath}'`);
  }
  for (const candidateNodeModulesPath of nodeModulePaths) {
    const candidateDirectory = path.join(candidateNodeModulesPath, moduleDirectory);
    const directoryStat = fs.statSync(candidateDirectory, { throwIfNoEntry: false });
    if (directoryStat && directoryStat.isDirectory()) {
      for (const candidateFilename of fs.readdirSync(candidateDirectory)) {
        if (candidateFilename.startsWith(moduleFilenamePrefix)) {
          return path.join(candidateNodeModulesPath, modulePath);
        }
      }
    }
  }
  throw new Error(`Failed to resolve '${modulePath}'`);
}

type PatchOptions = {
  /**
   * Don't write any files.
   * @default false
   */
  dryRun?: boolean;
  /**
   * A pattern to use when traversing the file system.
   * @default "**"
   */
  pattern?: string;
  /**
   * A set of patterns to exclude when traversing the file system.
   */
  excludePatterns: Set<string>;
  /**
   * Exclude any binary files.
   * @default true
   */
  excludeBinaries?: boolean;
  /**
   * Exclude any path which is listen in a .gitignore file.
   */
  excludeGitIgnored?: boolean;
};

/**
 * Replacement from a path to another path in a particular file.
 */
type Replacement = {
  from: string;
  to: string;
};

export function patchNodeModulePathsInFile(
  pathToPatch: string,
  dryRun: boolean,
): Array<Replacement> {
  const stats = fs.statSync(pathToPatch);
  assert(stats.isFile(), "Expected a path to a file");
  // Open the file and resolve any links
  debug("Reading", pathToPatch);
  const contents = fs.readFileSync(pathToPatch, "utf8");
  const appliedReplacements: { from: string, to: string }[] = [];
  const patched = contents.replace(/[^"'\s\\]+node_modules\/[^"'\s\\]+/g, (relativePath) => {
    const modulePath = relativePath.replace(/[^"'\s\\]+node_modules\//, "");
    try {
      const resolvedAbsolutePath = simpleNodeResolve(modulePath, pathToPatch);
      const resolvedRelativePath = path.relative(path.dirname(pathToPatch), resolvedAbsolutePath);
      if (relativePath !== resolvedRelativePath) {
        appliedReplacements.push({ from: relativePath, to: resolvedRelativePath });
      }
      return resolvedRelativePath;
    } catch (err) {
      console.warn(`Skipped resolving '${relativePath}' in '${pathToPatch}': ${err instanceof Error ? err.message : err}`);
      return relativePath;
    }
  });
  if (contents !== patched && !dryRun) {
    fs.writeFileSync(pathToPatch, patched, "utf8");
  }
  return appliedReplacements;
}

/**
 * Traverses a file system looking for occurrances of "node_modules",
 * resolves the module paths on disk and patches the file with the relative path to the file on disk.
 * @param rootPath The root directory from where the search will start
 * @param options Options controlling which files are considered when traversing the file system.
 * @returns An object mapping from file path relative to {@link rootPath} to an array of replacements.
 */
export async function patchNodeModulePaths(
  rootPath: string,
  {
    pattern = "**",
    dryRun = false,
    excludePatterns = new Set(),
    excludeBinaries = true,
    excludeGitIgnored = true,
  }: PatchOptions,
): Promise<Record<string, Array<Replacement>>> {
  const replacements: Record<string, Array<Replacement>> = {};
  for await (const relativePath of globbyStream(pattern, {
    cwd: rootPath,
    ignore: [
      ...excludePatterns,
      ...excludeBinaries ? binaryExtensions.map(ext => `**.${ext}`) : [],
    ],
    gitignore: excludeGitIgnored,
  })) {
    if (typeof relativePath !== "string") {
      throw new Error("Expected globbyStream to emit strings");
    }
    const absolutePath = path.join(rootPath, relativePath);
    const replacementsInFile = patchNodeModulePathsInFile(absolutePath, dryRun);
    if (replacementsInFile.length > 0) {
      replacements[relativePath] = replacementsInFile;
    }
  }
  return replacements;
}
