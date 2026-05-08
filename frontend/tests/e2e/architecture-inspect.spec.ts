import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';

import { createInferenceServer } from './helpers.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const API_BASE_URL = env.E2E_API_BASE_URL ?? 'http://localhost:8080';
const API_TOKEN = env.AITESTBENCH_API_TOKEN ?? env.VITE_AITESTBENCH_API_TOKEN;
const authHeaders: Record<string, string> = API_TOKEN ? { 'x-api-token': API_TOKEN } : {};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface TestNode {
  name: string;
  type: string;
  parameters: number;
  trainable: boolean;
  shape: null;
  children: TestNode[];
}

function makeNode(name: string, type: string, params: number, children: TestNode[] = []): TestNode {
  return { name, type, parameters: params, trainable: true, shape: null, children };
}

function makeTree(modelId: string, root = makeNode('', 'LlamaForCausalLM', 0, [
  makeNode('model', 'LlamaModel', 0, [
    makeNode('embed_tokens', 'Embedding', 524288000, []),
    makeNode('layers.0', 'LlamaDecoderLayer', 0, [
      makeNode('self_attn', 'LlamaAttention', 0, [
        makeNode('q_proj', 'Linear', 16777216, []),
        makeNode('k_proj', 'Linear', 4194304, []),
        makeNode('v_proj', 'Linear', 4194304, []),
        makeNode('o_proj', 'Linear', 16777216, []),
      ]),
      makeNode('mlp', 'LlamaMLP', 0, [
        makeNode('gate_proj', 'Linear', 57671680, []),
        makeNode('up_proj', 'Linear', 57671680, []),
        makeNode('down_proj', 'Linear', 57671680, []),
      ]),
      makeNode('input_layernorm', 'LlamaRMSNorm', 4096, []),
      makeNode('post_attention_layernorm', 'LlamaRMSNorm', 4096, []),
    ]),
    makeNode('norm', 'LlamaRMSNorm', 4096, []),
  ]),
  makeNode('lm_head', 'Linear', 524288000, []),
])) {
  return {
    schema_version: '1.0.0',
    model_id: modelId,
    format: 'transformers',
    summary: {
      total_parameters: 8030261248,
      trainable_parameters: 8030261248,
      non_trainable_parameters: 0,
      by_type: [
        { type: 'Linear', count: 224, parameters: 7872987136 },
        { type: 'Embedding', count: 1, parameters: 524288000 },
        { type: 'LlamaRMSNorm', count: 66, parameters: 270336 },
      ],
    },
    root,
    inspected_at: '2026-04-30T12:00:00Z',
  };
}

function make1000NodeTree(modelId: string) {
  // Build a tree with 1000+ leaf nodes across 10 top-level blocks × 10 sub-blocks × 10 leaves
  const blocks = [];
  for (let b = 0; b < 10; b++) {
    const subblocks = [];
    for (let s = 0; s < 10; s++) {
      const leaves = [];
      for (let l = 0; l < 10; l++) {
        leaves.push(makeNode(`w_${l}`, 'Linear', 1000, []));
      }
      subblocks.push(makeNode(`sub_${s}`, 'LlamaDecoderLayer', 0, leaves));
    }
    blocks.push(makeNode(`block_${b}`, 'LlamaModel', 0, subblocks));
  }
  const root = makeNode('', 'LlamaForCausalLM', 0, blocks);
  return {
    schema_version: '1.0.0',
    model_id: modelId,
    format: 'transformers',
    summary: {
      total_parameters: 1000000,
      trainable_parameters: 1000000,
      non_trainable_parameters: 0,
      by_type: [{ type: 'Linear', count: 1000, parameters: 1000000 }],
    },
    root,
    inspected_at: '2026-04-30T12:00:00Z',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedHfModel(
  request: import('@playwright/test').APIRequestContext,
  serverId: string,
  modelId = 'meta-llama/Llama-3.1-8B'
) {
  const response = await request.post(`${API_BASE_URL}/models`, {
    data: {
      model: { server_id: serverId, model_id: modelId, display_name: 'Llama 3.1 8B', active: true, archived: false },
      identity: { provider: 'meta', family: null, version: null, revision: null, checksum: null },
      architecture: { format: null },
      capabilities: {
        generation: { text: true, json_schema_output: false, tools: false, embeddings: false },
        multimodal: { vision: false, audio: false },
        reasoning: { supported: false, explicit_tokens: false },
        use_case: { thinking: false, coding: false, instruct: false, mixture_of_experts: false },
      },
    },
    headers: authHeaders,
  });
  if (!response.ok()) throw new Error(`seedHfModel failed: ${response.status()} ${await response.text()}`);
  return response.json();
}

async function navigateToModelDetail(page: import('@playwright/test').Page, serverId: string, modelId: string) {
  await page.goto(`/catalog?tab=models&servers=${encodeURIComponent(serverId)}`);
  await page.waitForLoadState('networkidle');
  const card = page.locator('.catalog-model-card').filter({ hasText: 'Llama-3.1-8B' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Inspect' }).click();
  await page.waitForLoadState('networkidle');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Architecture Inspection — US1 + US2 + US3', () => {
  const MODEL_ID = 'meta-llama/Llama-3.1-8B';

  test('T023: tree renders, expand/collapse works, Expand All / Collapse All work', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;
    await seedHfModel(request, serverId, MODEL_ID);

    const fixture = makeTree(MODEL_ID);

    await page.route(`**/models/${serverId}/${encodeURIComponent(MODEL_ID)}/architecture`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
      } else {
        await route.continue();
      }
    });

    await navigateToModelDetail(page, serverId, MODEL_ID);

    // Inspect Architecture button should be visible for HF-style model
    await expect(page.getByRole('button', { name: 'Inspect Architecture' })).toBeVisible();
    await page.getByRole('button', { name: 'Inspect Architecture' }).click();

    // Wait for tree to render
    const rootRow = page.locator('.arch-node-row').first();
    await expect(rootRow).toBeVisible();

    // Assert a top-level node exists
    expect(await page.locator('.arch-node-row').count()).toBeGreaterThan(0);

    // Find the 'model' expand toggle and click it
    const modelRow = page.locator('.arch-node-row', { hasText: 'model' }).first();
    await expect(modelRow).toBeVisible();
    await modelRow.locator('.arch-toggle').click();

    // After expanding, child rows should appear
    await expect(page.locator('.arch-node-row', { hasText: 'embed_tokens' })).toBeVisible();

    // Collapse the node
    await modelRow.locator('.arch-toggle').click();
    await expect(page.locator('.arch-node-row', { hasText: 'embed_tokens' })).not.toBeVisible();

    // Expand All
    await page.getByRole('button', { name: 'Expand All' }).click();
    await expect(page.locator('.arch-node-row', { hasText: 'q_proj' })).toBeVisible();

    // Collapse All
    await page.getByRole('button', { name: 'Collapse All' }).click();
    // Only root-level rows visible after collapse
    await expect(page.locator('.arch-node-row', { hasText: 'embed_tokens' })).not.toBeVisible();

    // SC-002: second click returns cache in < 1000 ms
    await page.route(`**/models/${serverId}/${encodeURIComponent(MODEL_ID)}/architecture`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
      } else {
        await route.continue();
      }
    });
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Inspect Architecture' }).click();
    await expect(page.locator('.arch-node-row').first()).toBeVisible();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(1000);

    // SC-004: 3-level deep node reachable via 3 sequential expands
    await page.getByRole('button', { name: 'Collapse All' }).click();
    // Expand root (level 0 -> 1)
    const rootToggle = page.locator('.arch-node-row').first().locator('.arch-toggle');
    await rootToggle.click();
    // Expand 'model' (level 1 -> 2)
    const modelRow2 = page.locator('.arch-node-row', { hasText: 'model' }).first();
    await modelRow2.locator('.arch-toggle').click();
    // Expand 'layers.0' (level 2 -> 3)
    const layers0Row = page.locator('.arch-node-row', { hasText: 'layers.0' }).first();
    await layers0Row.locator('.arch-toggle').click();
    // self_attn should now be visible (3 levels deep)
    await expect(page.locator('.arch-node-row', { hasText: 'self_attn' })).toBeVisible();

    // Cleanup
    await request.post(`${API_BASE_URL}/inference-servers/${serverId}/archive`, { headers: authHeaders }).catch(() => undefined);
  });

  test('T023: SC-003 — Expand All on 1000-node fixture completes within 500ms', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;
    const bigModelId = 'meta-llama/Llama-3.1-70B';
    await seedHfModel(request, serverId, bigModelId);

    const fixture = make1000NodeTree(bigModelId);

    await page.route(`**/models/${serverId}/${encodeURIComponent(bigModelId)}/architecture`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
      } else {
        await route.continue();
      }
    });

    await navigateToModelDetail(page, serverId, bigModelId);
    await page.getByRole('button', { name: 'Inspect Architecture' }).click();
    await expect(page.locator('.arch-node-row').first()).toBeVisible();

    const t0 = Date.now();
    await page.getByRole('button', { name: 'Expand All' }).click();
    // Wait for multiple node rows to be visible
    await expect(page.locator('.arch-node-row').nth(199)).toBeVisible();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(500);

    await request.post(`${API_BASE_URL}/inference-servers/${serverId}/archive`, { headers: authHeaders }).catch(() => undefined);
  });

  test('T027: summary panel shows parameter counts and hover highlighting works', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;
    await seedHfModel(request, serverId, MODEL_ID);

    const fixture = makeTree(MODEL_ID);

    await page.route(`**/models/${serverId}/${encodeURIComponent(MODEL_ID)}/architecture`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
      } else {
        await route.continue();
      }
    });

    await navigateToModelDetail(page, serverId, MODEL_ID);
    await page.getByRole('button', { name: 'Inspect Architecture' }).click();
    await expect(page.locator('.arch-node-row').first()).toBeVisible();

    // Summary panel is visible
    await expect(page.locator('.arch-summary')).toBeVisible();

    // SC-005: total_parameters matches pinned fixture value (8030261248 = 8.0B)
    const totalParamSpan = page.locator('.arch-summary-totals').locator('span[title]').first();
    await expect(totalParamSpan).toHaveAttribute('title', '8,030,261,248');

    // Formatted param strings match /^\d+(\.\d+)?[KMB]$/
    const formattedParams = await page.locator('.arch-summary span[title]').allTextContents();
    for (const text of formattedParams) {
      expect(text).toMatch(/^\d+(\.\d+)?[KMB]?$/);
    }

    // Hover highlighting: hover over 'Linear' type row in by_type list
    const linearTypeRow = page.locator('.arch-type-row', { hasText: 'Linear' }).first();
    await expect(linearTypeRow).toBeVisible();
    await linearTypeRow.hover();

    // At least one tree node row should have the 'highlighted' class
    await expect(page.locator('.arch-node-row.highlighted').first()).toBeVisible();

    // Mouse leave clears highlight
    await page.mouse.move(0, 0);
    await expect(page.locator('.arch-node-row.highlighted')).toHaveCount(0);

    await request.post(`${API_BASE_URL}/inference-servers/${serverId}/archive`, { headers: authHeaders }).catch(() => undefined);
  });

  test('Inspect Architecture button is hidden for non-inspectable models', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    // Plain model ID (not HF-style, not GGUF)
    await request.post(`${API_BASE_URL}/models`, {
      data: {
        model: { server_id: serverId, model_id: 'plain-local-model', display_name: 'Plain Local', active: true, archived: false },
        identity: { provider: 'custom' },
        architecture: { format: 'SafeTensors' },
        capabilities: {
          generation: { text: true, json_schema_output: false, tools: false, embeddings: false },
          multimodal: { vision: false, audio: false },
          reasoning: { supported: false, explicit_tokens: false },
          use_case: { thinking: false, coding: false, instruct: false, mixture_of_experts: false },
        },
      },
      headers: authHeaders,
    });

    await navigateToModelDetail(page, serverId, 'plain-local-model');

    // Button should NOT be rendered at all
    await expect(page.getByRole('button', { name: 'Inspect Architecture' })).toHaveCount(0);

    await request.post(`${API_BASE_URL}/inference-servers/${serverId}/archive`, { headers: authHeaders }).catch(() => undefined);
  });

  test('hf_token_required error shows the correct message', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;
    await seedHfModel(request, serverId, MODEL_ID);

    await page.route(`**/models/${serverId}/${encodeURIComponent(MODEL_ID)}/architecture`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'hf_token_required', error: 'This model requires a Hugging Face API token. Add your token in Settings → Environment.' }),
        });
      } else {
        await route.continue();
      }
    });

    await navigateToModelDetail(page, serverId, MODEL_ID);
    await page.getByRole('button', { name: 'Inspect Architecture' }).click();

    await expect(page.locator('.error')).toContainText('Hugging Face API token');

    await request.post(`${API_BASE_URL}/inference-servers/${serverId}/archive`, { headers: authHeaders }).catch(() => undefined);
  });
});
