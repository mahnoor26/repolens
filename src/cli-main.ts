import fs from 'node:fs';
import path from 'node:path';
import { Command, CommanderError, Option } from 'commander';
import { audit, builtInRules, shouldFail } from './engine.js';
import { loadConfig } from './config.js';
import { htmlReport, jsonReport, shouldColor, terminalReport, terminalSafe, type ColorMode } from './reporters.js';
import { starterConfig } from './starter-config.js';
import { severities, type Severity } from './types.js';

export interface CliIO { out(text: string): void; err(text: string): void }
/** Injectable output and an explicit exit code keep the CLI testable without child processes. */
export function runCli(args: string[], io: CliIO = { out: text => process.stdout.write(text), err: text => process.stderr.write(text) }): number {
  const command = new Command()
    .name('repolens').description('Turn engineering standards into executable rules. Local React/TypeScript audits.')
    .version('0.1.3').argument('[repository]', 'repository directory', '.')
    .option('--config <path>', 'YAML configuration path, relative to repository')
    .option('--json', 'write machine-readable JSON to stdout')
    .option('--init', 'create a commented .repolens.yml that owners can edit, then exit')
    .option('--html [path]', 'write a standalone HTML report (default: repolens-report.html)')
    .option('--overwrite', 'explicitly allow replacing an existing HTML report')
    .option('--verbose', 'include explanations and policy evidence in terminal output')
    .addOption(new Option('--color <mode>', 'terminal colors: auto, always, or never').choices(['auto', 'always', 'never']).default('auto'))
    .option('--list-rules', 'list built-in rule IDs and exit')
    .option('--fix', 'reserved: automatic fixes are not available in V1')
    .option('--changed', 'reserved: changed-file analysis is not available in V1')
    .addOption(new Option('--fail-on <severity>', 'exit 1 for findings at or above this severity').choices([...severities, 'none']))
    .addHelpText('after', '\nExamples:\n  repolens ./my-app --init\n  repolens ./my-app --verbose\n  repolens ./my-app --json > report.json\n  repolens ./my-app --html report.html --fail-on high\n\nExit codes: 0 completed, 1 threshold exceeded, 2 configuration/analysis error.\nThe default threshold is none. Repository source is never executed.')
    .configureOutput({ writeOut: text => io.out(terminalSafe(text)), writeErr: text => io.err(terminalSafe(text)) }).exitOverride();
  try {
    command.parse(args, { from: 'user' });
    const opts = command.opts();
    if (opts.listRules) {
      if (opts.json) io.out(JSON.stringify(builtInRules.map(({ check, appliesTo, ...metadata }) => metadata), null, 2) + '\n');
      else io.out(builtInRules.map(r => `${r.id.padEnd(28)} ${r.category.padEnd(14)} ${r.severity.padEnd(7)} ${r.defaultEnabled === false ? '[opt-in] ' : ''}${r.description}`).join('\n') + '\n');
      return 0;
    }
    if (opts.fix || opts.changed) throw new Error(`${opts.fix ? '--fix' : '--changed'} is a V2 feature and is not implemented. Run a full read-only audit without this flag.`);
    if (opts.overwrite && !opts.html) throw new Error('--overwrite requires --html.');
    const repository = path.resolve(command.args[0] ?? '.');
    if (opts.init) {
      if (!fs.existsSync(repository) || !fs.statSync(repository).isDirectory()) throw new Error(`Repository is not a directory: ${repository}`);
      const target = path.join(repository, '.repolens.yml');
      if (fs.existsSync(target)) throw new Error(`A rules file already exists: ${target}. Edit it directly; RepoLens will not overwrite it.`);
      fs.writeFileSync(target, starterConfig, { encoding: 'utf8', flag: 'wx' });
      io.out(`Created ${target}\nEdit this file in plain language comments, then run: repolens . --html repolens-report.html\n`);
      return 0;
    }
    const report = audit(repository, { config: opts.config });
    if (opts.html) {
      const target = path.resolve(typeof opts.html === 'string' ? opts.html : 'repolens-report.html');
      if (!/\.html?$/i.test(target)) throw new Error('HTML output path must end in .html or .htm.');
      // Even explicit overwrites must not follow symlink destinations.
      if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Refusing to write a report through a symlink.');
      fs.writeFileSync(target, htmlReport(report), { encoding: 'utf8', flag: opts.overwrite ? 'w' : 'wx' });
      io.err(terminalSafe(`HTML report saved: ${target}\n`));
    }
    io.out((opts.json ? jsonReport(report) : terminalReport(report, !!opts.verbose, shouldColor(opts.color as ColorMode))) + '\n');
    const config = loadConfig(fs.realpathSync(repository), opts.config);
    return shouldFail(report, (opts.failOn ?? config.failOn ?? 'none') as Severity | 'none') ? 1 : 0;
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 2;
    io.err(terminalSafe(`RepoLens: ${error instanceof Error ? error.message : String(error)}\n`)); return 2;
  }
}
