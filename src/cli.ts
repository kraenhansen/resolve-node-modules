import path from "node:path";
import { program } from '@commander-js/extra-typings';
import chalk from "chalk";

import { patchNodeModulePaths } from "./index.js";

const options = program
  .name("resolve-node-modules")
  .argument("[root]", "Path to directory or file, from where a recursive patch will be applied", (value) => path.resolve(value))
  .option("--dry-run", "Don't write to any files", false)
  .option("--exclude <pattern...>", "Glob patterns to exlude", ["node_modules"])
  .option("--include-binaries", "Skip exluding binary file extensions", false)
  .option("--include-git-ignored", "Skip exluding files from .gitignore files", false)
  .action((rootPath = path.resolve("."), { dryRun, exclude, includeBinaries, includeGitIgnored }) => {
    console.log(`Patching files containing 'node_modules' in '${rootPath}'`);
    if (dryRun) {
      console.log(chalk.dim("(except no files will be updated, as this is a dry run)"))
    }
    patchNodeModulePaths(rootPath, {
      dryRun,
      excludeBinaries: !includeBinaries,
      excludeGitIgnored: !includeGitIgnored,
      excludePatterns: new Set(exclude),
    }).then((replacements) => {
      console.log("\nReplacements:");
      for (const [path, replacementsInFile] of Object.entries(replacements)) {
        console.log(chalk.dim(path));
        for (const { from, to } of replacementsInFile) {
          console.log(`  '${from}' → '${to}'`);
        }
      }
    }, (err) => {
      process.exitCode = 1;
      console.error(err instanceof Error ? err.message : err);
    });
  }).parse();
