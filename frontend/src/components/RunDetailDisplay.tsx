import type { EvaluationQueueDetail } from '../services/evaluation-queue-api.js';

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

export function RunDetailDisplay({ detail }: { detail: EvaluationQueueDetail | null }) {
  if (!detail) {
    return (
      <div className="run-detail-display is-empty">
        <h2>No run selected</h2>
        <p>Select a queue item to inspect the prompt, response, checks, and raw envelope.</p>
      </div>
    );
  }

  return (
    <div className="run-detail-display">
      <header>
        <div>
          <span className="label--uppercase">Evaluating run · {detail.run_id}</span>
          <h2>{detail.model_name} {'->'} {detail.template_label}</h2>
        </div>
        <span className={`run-status-pill status-${detail.verdict}`}>{detail.verdict}</span>
      </header>
      <div className="run-detail-columns">
        <section>
          <h3>Prompt</h3>
          <pre>{detail.prompt_text}</pre>
          <h3>Auto-checks</h3>
          <div className="run-detail-kv">
            <span>Verdict</span><strong>{detail.verdict}</strong>
            <span>Latency</span><strong>{valueOrDash(detail.metrics.latency_ms ?? detail.metrics.total_ms)} ms</strong>
            <span>Tokens</span><strong>{valueOrDash(detail.metrics.total_tokens)}</strong>
          </div>
        </section>
        <section>
          <h3>Response</h3>
          <pre>{detail.answer_text || 'No response body captured.'}</pre>
          <details>
            <summary>Raw envelope</summary>
            <pre>{JSON.stringify({
              metrics: detail.metrics,
              artefacts: detail.artefacts,
              raw_events: detail.raw_events,
              document: detail.document
            }, null, 2)}</pre>
          </details>
        </section>
      </div>
    </div>
  );
}
