import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { ArchitectureTreeView } from '../../src/components/ArchitectureTree.js';

const root = {
  name: '',
  type: 'Model',
  parameters: 0,
  trainable: true,
  shape: null,
  children: [
    {
      name: 'embed_tokens',
      type: 'Embedding',
      parameters: 1000,
      trainable: true,
      shape: [100, 10],
      children: [],
    },
  ],
};

const summary = {
  total_parameters: 1000,
  trainable_parameters: 1000,
  non_trainable_parameters: 0,
  by_type: [{ type: 'Embedding', count: 1, parameters: 1000 }],
};

test('renders estimated trees with provenance and approximate summary counts', () => {
  const html = renderToStaticMarkup(
    React.createElement(ArchitectureTreeView, {
      root,
      summary,
      accuracy: 'estimated',
      inspectionMethod: 'config_fallback',
      warnings: ['Config fallback estimates parameters.'],
    })
  );

  expect(html).toContain('Config Fallback');
  expect(html).toContain('~1.0K');
  expect(html).toContain('embed_tokens');
});

test('renders exact trees without an estimated provenance label', () => {
  const html = renderToStaticMarkup(
    React.createElement(ArchitectureTreeView, {
      root,
      summary,
      accuracy: 'exact',
      inspectionMethod: 'transformers_exact',
    })
  );

  expect(html).not.toContain('Config Fallback');
  expect(html).not.toContain('~1.0K');
  expect(html).toContain('1.0K');
});
