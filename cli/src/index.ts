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

import { ApiClient } from './lib/api-client.ts';
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
  return args[index + 1];
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
    const name = getArg('--name', args);
    const baseUrl = getArg('--base-url', args);
    const authType = getArg('--type', args);
    if (!name || !baseUrl) {
      throw new Error('Missing required --name or --base-url');
    }
    const result = await addTarget(client, { name, base_url: baseUrl, auth_type: authType ?? 'none' });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'target' && subcommand === 'list') {
    const result = await listTargets(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'target' && subcommand === 'delete') {
    const id = getArg('--id', args);
    if (!id) {
      throw new Error('Missing required --id');
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
    const id = getArg('--id', args);
    if (!id) {
      throw new Error('Missing required --id');
    }
    const name = getArg('--name', args);
    const baseUrl = getArg('--base-url', args);
    const authType = getArg('--type', args);
    const payload: Record<string, unknown> = {};
    if (name) payload.name = name;
    if (baseUrl) payload.base_url = baseUrl;
    if (authType) payload.auth_type = authType;
    const result = await updateTarget(client, id, payload);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'test' && subcommand === 'run') {
    const testId = getArg('--id', args);
    const targetId = getArg('--target', args);
    if (!testId || !targetId) {
      throw new Error('Missing required --id or --target');
    }
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
    const suiteId = getArg('--id', args);
    const targetId = getArg('--target', args);
    if (!suiteId || !targetId) {
      throw new Error('Missing required --id or --target');
    }
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
    const id = getArg('--id', args);
    const name = getArg('--name', args);
    if (!id || !name) {
      throw new Error('Missing required --id or --name');
    }
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
    const result = await reloadTests(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'profiles' && subcommand === 'list') {
    const result = await listProfiles(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'profiles' && subcommand === 'create') {
    const id = getArg('--id', args);
    const version = getArg('--version', args);
    const name = getArg('--name', args);
    if (!id || !version || !name) {
      throw new Error('Missing required --id, --version, or --name');
    }
    const result = await createProfile(client, {
      id,
      version,
      name
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'models' && subcommand === 'list') {
    const result = await listModels(client);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'export') {
    const format = getArg('--format', args) as 'json' | 'csv' | undefined;
    const runId = getArg('--run-id', args);
    if (!format || !runId) {
      throw new Error('Missing required --format or --run-id');
    }
    const result = await exportResults(client, format, runId);
    process.stdout.write(JSON.stringify(result, null, 2));
    return;
  }

  printHelp();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
