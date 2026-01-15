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

import { ApiClient, ApiError } from './lib/api-client.js';
import { addInferenceServer, archiveInferenceServer, updateInferenceServer } from './commands/inference-server.js';
import { runTest } from './commands/test.js';
import { createSuite, runSuite } from './commands/suite.js';
import { exportResults } from './commands/export.js';
import { listInferenceServers } from './commands/inference-servers-list.js';
import { listTests } from './commands/tests-list.js';
import { listSuites } from './commands/suites-list.js';
import { reloadTests } from './commands/tests.js';
import { createProfile, listProfiles } from './commands/profile.js';
import { listModels } from './commands/model.js';

class CliUsageError extends Error {}

function printHelp(): void {
  const message = `LLM Test Harness CLI

Commands:
  server add --name <name> --base-url <url> [--schema-family <family[,family...]>] [--auth-type <type>] [--auth-header <name>] [--token-env <env>]
  server list
  server archive --id <serverId>
  server update --id <serverId> [--name <name>] [--base-url <url>] [--schema-family <family[,family...]>] [--auth-type <type>] [--auth-header <name>] [--token-env <env>] [--active <true|false>]
  test run --id <testId> --server <serverId> [--profile-id <id>] [--profile-version <ver>]
  suite run --id <suiteId> --server <serverId> [--profile-id <id>] [--profile-version <ver>]
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

function parseSchemaFamilies(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const families = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (families.length === 0) {
    throw new CliUsageError('schema-family must include at least one value');
  }
  return families;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    return;
  }

  const client = new ApiClient();
  const [command, subcommand] = args;

  if (command === 'server' && subcommand === 'add') {
    ensureKnownFlags(args, { '--base_url': '--base-url', '--baseUrl': '--base-url' });
    ensureAllowedFlags(args, ['--name', '--base-url', '--schema-family', '--auth-type', '--auth-header', '--token-env']);
    ensureFlagValues(args, ['--name', '--base-url', '--schema-family', '--auth-type', '--auth-header', '--token-env']);
    ensureRequiredFlags(args, ['--name', '--base-url']);
    const name = getArg('--name', args)!;
    const baseUrl = getArg('--base-url', args)!;
    const schemaFamily = parseSchemaFamilies(getArg('--schema-family', args)) ?? ['openai-compatible'];
    const authType = getArg('--auth-type', args) ?? 'none';
    const authHeader = getArg('--auth-header', args) ?? 'Authorization';
    const tokenEnv = getArg('--token-env', args) ?? null;
    const result = await addInferenceServer(client, {
      inference_server: { display_name: name },
      endpoints: { base_url: baseUrl },
      runtime: { api: { schema_family: schemaFamily, api_version: null } },
      auth: { type: authType, header_name: authHeader, token_env: tokenEnv }
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'server' && subcommand === 'list') {
    ensureAllowedFlags(args, []);
    const result = await listInferenceServers(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'server' && subcommand === 'archive') {
    ensureAllowedFlags(args, ['--id']);
    ensureFlagValues(args, ['--id']);
    const id = getArg('--id', args);
    if (!id) {
      throw new CliUsageError('Missing required --id');
    }
    const result = await archiveInferenceServer(client, id);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'server' && subcommand === 'update') {
    ensureAllowedFlags(args, ['--id', '--name', '--base-url', '--schema-family', '--auth-type', '--auth-header', '--token-env', '--active']);
    ensureFlagValues(args, ['--id', '--name', '--base-url', '--schema-family', '--auth-type', '--auth-header', '--token-env', '--active']);
    const id = getArg('--id', args);
    if (!id) {
      throw new CliUsageError('Missing required --id');
    }
    ensureKnownFlags(args, { '--base_url': '--base-url', '--baseUrl': '--base-url' });
    const name = getArg('--name', args);
    const baseUrl = getArg('--base-url', args);
    const schemaFamily = parseSchemaFamilies(getArg('--schema-family', args));
    const authType = getArg('--auth-type', args);
    const authHeader = getArg('--auth-header', args);
    const tokenEnv = getArg('--token-env', args);
    const active = getArg('--active', args);
    if (!name && !baseUrl && !schemaFamily && !authType && !authHeader && !tokenEnv && !active) {
      throw new CliUsageError('Missing update fields (--name, --base-url, --schema-family, --auth-type, --auth-header, --token-env, or --active)');
    }
    const payload: Record<string, unknown> = {};
    if (name || active !== undefined) {
      payload.inference_server = {};
      if (name) payload.inference_server.display_name = name;
      if (active !== undefined) payload.inference_server.active = active === 'true';
    }
    if (baseUrl) {
      payload.endpoints = { base_url: baseUrl };
    }
    if (schemaFamily) {
      payload.runtime = { api: { schema_family: schemaFamily } };
    }
    if (authType || authHeader || tokenEnv) {
      payload.auth = {
        ...(authType ? { type: authType } : {}),
        ...(authHeader ? { header_name: authHeader } : {}),
        ...(tokenEnv ? { token_env: tokenEnv } : {})
      };
    }
    const result = await updateInferenceServer(client, id, payload);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'test' && subcommand === 'run') {
    ensureAllowedFlags(args, ['--id', '--server', '--profile-id', '--profile-version']);
    ensureFlagValues(args, ['--id', '--server', '--profile-id', '--profile-version']);
    ensureRequiredFlags(args, ['--id', '--server']);
    const testId = getArg('--id', args)!;
    const serverId = getArg('--server', args)!;
    const profileId = getArg('--profile-id', args);
    const profileVersion = getArg('--profile-version', args);
    const result = await runTest(client, {
      test_id: testId,
      inference_server_id: serverId,
      profile_id: profileId,
      profile_version: profileVersion
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'suite' && subcommand === 'run') {
    ensureAllowedFlags(args, ['--id', '--server', '--profile-id', '--profile-version']);
    ensureFlagValues(args, ['--id', '--server', '--profile-id', '--profile-version']);
    ensureRequiredFlags(args, ['--id', '--server']);
    const suiteId = getArg('--id', args)!;
    const serverId = getArg('--server', args)!;
    const profileId = getArg('--profile-id', args);
    const profileVersion = getArg('--profile-version', args);
    const result = await runSuite(client, {
      suite_id: suiteId,
      inference_server_id: serverId,
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
