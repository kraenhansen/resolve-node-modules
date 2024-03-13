# Resolve Node Modules

Traverses a filesystem looking for occurrances of "node_modules", resolves the module paths on disk and patches the file with the relative path to the file on disk.

## The `resolve-node-modules` CLI

```
Usage: resolve-node-modules [options] [root]

Arguments:
  root                    Path to directory or file, from where a recursive patch will be applied

Options:
  --dry-run               Don't write to any files (default: false)
  --exclude <pattern...>  Glob patterns to exlude (default: ["node_modules"])
  --include-binaries      Skip exluding binary file extensions (default: false)
  --include-git-ignored   Skip exluding files from .gitignore files (default: false)
  -h, --help              display help for command
```

## Programatic use

Exports the `patchNodeModulePaths` function, which can be called to patch files programatically:

```ts
/**
 * Options controlling which files are considered when traversing the file system.
 */
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

/**
 * Traverses a file system looking for occurrances of "node_modules",
 * resolves the module paths on disk and patches the file with the relative path to the file on disk.
 * @param rootPath The root directory from where the search will start
 * @param options Options controlling which files are considered when traversing the file system.
 * @returns An object mapping from file path relative to {@link rootPath} to an array of replacements.
 */
function patchNodeModulePaths(
  rootPath: string,
  options: PatchOptions,
): Promise<Record<string, Array<Replacement>>>;
```
