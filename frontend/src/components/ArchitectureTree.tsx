import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ArchitectureLayerNode, ArchitectureSummary } from '../services/architecture-api.js';

// ─── formatParams ────────────────────────────────────────────────────────────

export function formatParams(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

// ─── Layer type color coding ──────────────────────────────────────────────────

function layerColor(type: string): string {
  if (/norm|layernorm|batchnorm|groupnorm|rmsnorm/i.test(type)) return 'var(--warning-dot)';
  if (/relu|gelu|silu|tanh|sigmoid|activation/i.test(type)) return 'var(--ok)';
  if (/attention|multiheadattention|linear|embedding|conv2d/i.test(type)) return 'var(--gold-5)';
  return 'var(--ink-3)';
}

// ─── Flatten visible nodes ────────────────────────────────────────────────────

interface FlatNode {
  node: ArchitectureLayerNode;
  depth: number;
  path: string;
  hasChildren: boolean;
}

function childFocusPath(parent: string, child: ArchitectureLayerNode): string {
  const name = child.name.trim();
  if (!name) return parent;
  return parent ? `${parent}.${name}` : name;
}

function flattenVisible(
  node: ArchitectureLayerNode,
  depth: number,
  path: string,
  expanded: Map<string, boolean>,
  out: FlatNode[]
): void {
  const hasChildren = node.children.length > 0;
  out.push({ node, depth, path, hasChildren });
  if (hasChildren && expanded.get(path)) {
    for (const child of node.children) {
      flattenVisible(child, depth + 1, childFocusPath(path, child), expanded, out);
    }
  }
}

function collectAllPaths(
  node: ArchitectureLayerNode,
  path: string,
  out: string[]
): void {
  out.push(path);
  for (const child of node.children) {
    collectAllPaths(child, childFocusPath(path, child), out);
  }
}

function parseOpenHash(): Map<string, boolean> | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const open = params.get('open');
  if (open == null) return null;
  const expanded = new Map<string, boolean>();
  for (const raw of open.split(',').filter(Boolean)) {
    expanded.set(raw === '~' ? '' : raw, true);
  }
  return expanded;
}

function writeOpenHash(expanded: Map<string, boolean>) {
  const open = Array.from(expanded.entries())
    .filter(([, isOpen]) => isOpen)
    .map(([path]) => encodeURIComponent(path || '~'))
    .join(',');
  const nextHash = open ? `#open=${open}` : '#open=';
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function ancestorPaths(path: string): string[] {
  if (!path) return [''];
  const parts = path.split('.');
  const ancestors = [''];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}

function isSelectedPath(rowPath: string, selectedPath: string | null | undefined): boolean {
  if (!selectedPath) return rowPath === '';
  return rowPath === selectedPath || rowPath.endsWith(`.${selectedPath}`);
}

// ─── Row height constant ──────────────────────────────────────────────────────

const ROW_HEIGHT = 32;
const VIRTUALIZE_THRESHOLD = 200;

// ─── ArchitectureTreeView ─────────────────────────────────────────────────────

interface Props {
  root: ArchitectureLayerNode;
  summary: ArchitectureSummary;
  accuracy?: 'exact' | 'estimated';
  inspectionMethod?: string;
  warnings?: string[];
  selectedPath?: string | null;
  onSelect?: (path: string, node: ArchitectureLayerNode) => void;
  showSummary?: boolean;
}

function provenanceLabel(method?: string): string {
  if (!method) return 'Estimated';
  return method
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ArchitectureTreeView({
  root,
  summary,
  accuracy,
  inspectionMethod,
  warnings = [],
  selectedPath,
  onSelect,
  showSummary = true
}: Props) {
  const rootPath = '';
  const [expanded, setExpanded] = useState<Map<string, boolean>>(() => parseOpenHash() ?? new Map([[rootPath, true]]));
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const allPaths = useMemo(() => {
    const paths: string[] = [];
    collectAllPaths(root, rootPath, paths);
    return paths;
  }, [root, rootPath]);

  const expandAll = useCallback(() => {
    setExpanded(new Map(allPaths.map((p) => [p, true])));
  }, [allPaths]);

  const collapseAll = useCallback(() => {
    setExpanded(new Map());
  }, []);

  const toggleNode = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Map(prev);
      next.set(path, !prev.get(path));
      return next;
    });
  }, []);

  const visibleNodes = useMemo(() => {
    const out: FlatNode[] = [];
    flattenVisible(root, 0, rootPath, expanded, out);
    return out;
  }, [root, rootPath, expanded]);

  useEffect(() => {
    if (!selectedPath) return;
    setExpanded((prev) => {
      const next = new Map(prev);
      for (const path of ancestorPaths(selectedPath)) {
        next.set(path, true);
      }
      return next;
    });
  }, [selectedPath]);

  useEffect(() => {
    writeOpenHash(expanded);
  }, [expanded]);

  const useVirtual = visibleNodes.length > VIRTUALIZE_THRESHOLD;
  const containerHeight = useVirtual ? Math.min(visibleNodes.length, 200) * ROW_HEIGHT : undefined;

  const firstVisible = useVirtual ? Math.floor(scrollTop / ROW_HEIGHT) : 0;
  const visibleCount = useVirtual ? Math.ceil((containerHeight ?? 0) / ROW_HEIGHT) + 2 : visibleNodes.length;
  const renderedSlice = useVirtual
    ? visibleNodes.slice(firstVisible, firstVisible + visibleCount)
    : visibleNodes;
  const paddingTop = useVirtual ? firstVisible * ROW_HEIGHT : 0;
  const paddingBottom = useVirtual
    ? (visibleNodes.length - (firstVisible + visibleCount)) * ROW_HEIGHT
    : 0;

  const sortedByType = useMemo(
    () => [...summary.by_type].sort((a, b) => b.parameters - a.parameters),
    [summary.by_type]
  );

  return (
    <div className="architecture-tree">
      {/* Summary panel */}
      {showSummary ? <div className="arch-summary">
        {accuracy === 'estimated' ? (
          <div className="arch-provenance" title={warnings.join(' ') || 'Estimated from model configuration.'}>
            {provenanceLabel(inspectionMethod)}
          </div>
        ) : null}
        <div className="arch-summary-totals">
          <div>
            <span>Total parameters</span>
            <strong>
              <span title={summary.total_parameters.toLocaleString()}>
                {accuracy === 'estimated' ? '~' : ''}{formatParams(summary.total_parameters)}
              </span>
            </strong>
          </div>
          <div>
            <span>Trainable</span>
            <strong>
              <span title={summary.trainable_parameters.toLocaleString()}>
                {accuracy === 'estimated' ? '~' : ''}{formatParams(summary.trainable_parameters)}
              </span>
            </strong>
          </div>
          <div>
            <span>Non-trainable</span>
            <strong>
              <span title={summary.non_trainable_parameters.toLocaleString()}>
                {accuracy === 'estimated' ? '~' : ''}{formatParams(summary.non_trainable_parameters)}
              </span>
            </strong>
          </div>
        </div>
        <div className="arch-summary-by-type">
          {sortedByType.map((entry) => (
            <div
              key={entry.type}
              className={`arch-type-row${highlightedType === entry.type ? ' highlighted' : ''}`}
              onMouseEnter={() => setHighlightedType(entry.type)}
              onMouseLeave={() => setHighlightedType(null)}
            >
              <span className="arch-type-badge" style={{ color: layerColor(entry.type) }}>
                {entry.type}
              </span>
              <span className="arch-type-count">{entry.count}</span>
              <span title={entry.parameters.toLocaleString()}>{formatParams(entry.parameters)}</span>
            </div>
          ))}
        </div>
      </div> : null}

      {/* Controls */}
      <div className="arch-controls">
        <button type="button" onClick={expandAll}>Expand All</button>
        <button type="button" onClick={collapseAll}>Collapse All</button>
      </div>

      {/* Tree */}
      <div
        ref={containerRef}
        className="arch-tree-container"
        style={useVirtual ? { height: containerHeight, overflowY: 'scroll' } : undefined}
        onScroll={useVirtual ? (e) => setScrollTop((e.target as HTMLDivElement).scrollTop) : undefined}
      >
        {useVirtual ? <div style={{ height: paddingTop }} /> : null}
        {renderedSlice.map(({ node, depth, path, hasChildren }) => (
          <div
            key={path}
            className={`arch-node-row${highlightedType === node.type ? ' highlighted' : ''}${isSelectedPath(path, selectedPath) ? ' selected' : ''}`}
            style={{ paddingLeft: depth * 16 + 4, height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => onSelect?.(path, node)}
          >
            {hasChildren ? (
              <button
                type="button"
                className="arch-toggle"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleNode(path);
                }}
                aria-label={expanded.get(path) ? 'Collapse' : 'Expand'}
              >
                {expanded.get(path) ? '▼' : '▶'}
              </button>
            ) : (
              <span className="arch-toggle-spacer" />
            )}
            <span className="arch-node-name">{node.name || '<root>'}</span>
            <span className="arch-node-type" style={{ color: layerColor(node.type) }}>{node.type}</span>
            {node.parameters > 0 ? (
              <span className="arch-node-params" title={node.parameters.toLocaleString()}>
                {formatParams(node.parameters)}
              </span>
            ) : null}
            {node.shape ? (
              <span className="arch-node-shape">[{node.shape.join('×')}]</span>
            ) : null}
          </div>
        ))}
        {useVirtual && paddingBottom > 0 ? <div style={{ height: paddingBottom }} /> : null}
      </div>
    </div>
  );
}
