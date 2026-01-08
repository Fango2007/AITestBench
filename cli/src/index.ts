import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const envPath = path.join(repoRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import { ApiClient, ApiError } from './lib/api-client.ts';
import { addTarget, deleteTarget, updateTarget } from './commands/target.ts';
import { runTest } from './commands/test.ts';
import { createSuite, runSuite } from './commands/suite.ts';
import { exportResults } from './commands/export.ts';
import { listTargets } from './commands/targets-list.ts';
import { listTests } from './commands/tests-list.ts';
import { listSuites } from './commands/suites-list.ts';
import { reloadTests } from './commands/tests.ts';
import { createProfile, listProfiles } from './commands/profile.ts';
import { listModels } from './commands/model.ts';

class CliUsageError extends Error {}

function printHelp(): void {
  const message = `LLM Test Harness CLI

Commands:
  target add --name <name> --base-url <url> [--type <auth>]
  target list
  test run --id <testId> --target <targetId> [--profile-id <id>] [--profile-version <ver>]
  suite run --id <suiteId> --target <targetId> [--profile-id <id>] [--profile-version <ver>]
  tests reload
  profiles list
  models list
  export --format <json|csv> --run-id <runId>
`;
  process.stdout.write(message);
}

function getArg(flag: string, args: string[]): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    return undefined;
  }
  return value;
}

function listFlags(args: string[]): string[] {
  return args.filter((arg) => arg.startsWith('-'));
}

function ensureKnownFlags(args: string[], forbidden: Record<string, string>): void {
  for (const [flag, suggestion] of Object.entries(forbidden)) {
    if (args.includes(flag)) {
      const hint = suggestion ? ` Did you mean ${suggestion}?` : '';
      throw new CliUsageError(`Unknown flag ${flag}.${hint}`);
    }
  }
}

function ensureAllowedFlags(args: string[], allowed: string[]): void {
  const allowedSet = new Set(allowed);
  for (const flag of listFlags(args)) {
    if (!allowedSet.has(flag)) {
      throw new CliUsageError(`Unknown flag ${flag}.`);
    }
  }
}

function ensureFlagValues(args: string[], flags: string[]): void {
  for (const flag of flags) {
    if (args.includes(flag) && getArg(flag, args) === undefined) {
      throw new CliUsageError(`Missing value for ${flag}`);
    }
  }
}

function ensureRequiredFlags(args: string[], requiredFlags: string[]): void {
  const missing = requiredFlags.filter((flag) => getArg(flag, args) === undefined);
  if (missing.length > 0) {
    throw new CliUsageError(`Missing required ${missing.join(', ')}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    return;
  }

  const client = new ApiClient();
  const [command, subcommand] = args;

  if (command === 'target' && subcommand === 'add') {
    ensureKnownFlags(args, { '--base_url': '--base-url', '--baseUrl': '--base-url' });
    ensureAllowedFlags(args, ['--name', '--base-url', '--type']);
    ensureFlagValues(args, ['--name', '--base-url', '--type']);
    ensureRequiredFlags(args, ['--name', '--base-url']);
    const name = getArg('--name', args)!;
    const baseUrl = getArg('--base-url', args)!;
    const authType = getArg('--type', args);
    const result = await addTarget(client, { name, base_url: baseUrl, auth_type: authType ?? 'none' });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'target' && subcommand === 'list') {
    ensureAllowedFlags(args, []);
    const result = await listTargets(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'target' && subcommand === 'delete') {
    ensureAllowedFlags(args, ['--id']);
    ensureFlagValues(args, ['--id']);
    const id = getArg('--id', args);
    if (!id) {
      throw new CliUsageError('Missing required --id');
    }
    const result = await deleteTarget(client, id);
    if (!result.ok) {
      process.stdout.write(JSON.stringify({
        deleted: false,
        status: result.status,
        error: result.body ?? { message: 'Delete failed' }
      }, null, 2));
      return;
    }
    process.stdout.write(JSON.stringify({ deleted: id }, null, 2));
    return;
  }

  if (command === 'target' && subcommand === 'update') {
    ensureAllowedFlags(args, ['--id', '--name', '--base-url', '--type']);
    ensureFlagValues(args, ['--id', '--name', '--base-url', '--type']);
    const id = getArg('--id', args);
    if (!id) {
      throw new CliUsageError('Missing required --id');
    }
    ensureKnownFlags(args, { '--base_url': '--base-url', '--baseUrl': '--base-url' });
    const name = getArg('--name', args);
    const baseUrl = getArg('--base-url', args);
    const authType = getArg('--type', args);
    if (!name && !baseUrl && !authType) {
      throw new CliUsageError('Missing update fields (--name, --base-url, or --type)');
    }
    const payload: Record<string, unknown> = {};
    if (name) payload.name = name;
    if (baseUrl) payload.base_url = baseUrl;
    if (authType) payload.auth_type = authType;
    const result = await updateTarget(client, id, payload);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'test' && subcommand === 'run') {
    ensureAllowedFlags(args, ['--id', '--target', '--profile-id', '--profile-version']);
    ensureFlagValues(args, ['--id', '--target', '--profile-id', '--profile-version']);
    ensureRequiredFlags(args, ['--id', '--target']);
    const testId = getArg('--id', args)!;
    const targetId = getArg('--target', args)!;
    const profileId = getArg('--profile-id', args);
    const profileVersion = getArg('--profile-version', args);
    const result = await runTest(client, {
      test_id: testId,
      target_id: targetId,
      profile_id: profileId,
      profile_version: profileVersion
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'suite' && subcommand === 'run') {
    ensureAllowedFlags(args, ['--id', '--target', '--profile-id', '--profile-version']);
    ensureFlagValues(args, ['--id', '--target', '--profile-id', '--profile-version']);
    ensureRequiredFlags(args, ['--id', '--target']);
    const suiteId = getArg('--id', args)!;
    const targetId = getArg('--target', args)!;
    const profileId = getArg('--profile-id', args);
    const profileVersion = getArg('--profile-version', args);
    const result = await runSuite(client, {
      suite_id: suiteId,
      target_id: targetId,
      profile_id: profileId,
      profile_version: profileVersion
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'suite' && subcommand === 'create') {
    ensureAllowedFlags(args, ['--id', '--name', '--tests', '--stop-on-fail']);
    ensureFlagValues(args, ['--id', '--name', '--tests', '--stop-on-fail']);
    ensureRequiredFlags(args, ['--id', '--name']);
    const id = getArg('--id', args)!;
    const name = getArg('--name', args)!;
    const ordered = getArg('--tests', args);
    const stopOnFail = getArg('--stop-on-fail', args);
    const orderedIds = ordered ? ordered.split(',').map((item) => item.trim()).filter(Boolean) : [];
    const result = await createSuite(client, {
      id,
      name,
      ordered_test_ids: orderedIds,
      stop_on_fail: stopOnFail === 'true'
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'tests' && subcommand === 'reload') {
    ensureAllowedFlags(args, []);
    const result = await reloadTests(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'profiles' && subcommand === 'list') {
    ensureAllowedFlags(args, []);
    const result = await listProfiles(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'profiles' && subcommand === 'create') {
    ensureAllowedFlags(args, ['--id', '--version', '--name']);
    ensureFlagValues(args, ['--id', '--version', '--name']);
    ensureRequiredFlags(args, ['--id', '--version', '--name']);
    const id = getArg('--id', args)!;
    const version = getArg('--version', args)!;
    const name = getArg('--name', args)!;
    const result = await createProfile(client, {
      id,
      version,
      name
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'models' && subcommand === 'list') {
    ensureAllowedFlags(args, []);
    const result = await listModels(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'export') {
    ensureAllowedFlags(args, ['--format', '--run-id']);
    ensureFlagValues(args, ['--format', '--run-id']);
    const formatInput = getArg('--format', args);
    const runId = getArg('--run-id', args);
    const missing: string[] = [];
    if (!formatInput) missing.push('--format');
    if (!runId) missing.push('--run-id');
    if (missing.length > 0) {
      throw new CliUsageError(`Missing required ${missing.join(', ')}`);
    }
    if (formatInput !== 'json' && formatInput !== 'csv') {
      throw new CliUsageError('Invalid value for --format (expected json or csv)');
    }
    const result = await exportResults(client, formatInput, runId);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  throw new CliUsageError(`Unknown command: ${command}${subcommand ? ` ${subcommand}` : ''}`);
}

main().catch((error) => {
  if (error instanceof CliUsageError) {
    process.stderr.write(`${error.message}\n`);
    printHelp();
    return;
  }
  if (error instanceof ApiError) {
    const body = error.body === undefined
      ? ''
      : `\n${typeof error.body === 'string' ? error.body : JSON.stringify(error.body, null, 2)}`;
    process.stderr.write(`API error (${error.status}) for ${error.baseUrl}${error.path}${body}\n`);
    process.exit(1);
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
