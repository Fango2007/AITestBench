import { FormEvent, useEffect, useState } from 'react';

import {
  InferenceParamPreset,
  InferenceParams,
  createInferenceParamPreset,
  listInferenceParamPresets
} from '../services/inference-param-presets-api.js';

function paramValue(value: number | string | boolean | null): string {
  if (value === null || value === '') {
    return 'default';
  }
  return String(value);
}

export function InferenceContextBar({
  params,
  onChange,
  readOnly = false,
  visible = true
}: {
  params: InferenceParams;
  onChange?: (params: InferenceParams) => void;
  readOnly?: boolean;
  visible?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(params);
  const [presets, setPresets] = useState<InferenceParamPreset[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setDraft(params), [params]);

  useEffect(() => {
    if (!visible) return;
    listInferenceParamPresets().then(setPresets).catch(() => setPresets([]));
  }, [visible]);

  if (!visible) {
    return null;
  }

  async function handleSavePreset() {
    const name = window.prompt('Preset name');
    if (!name?.trim()) {
      return;
    }
    try {
      const created = await createInferenceParamPreset({ name: name.trim(), parameters: params });
      setPresets((current) => [...current.filter((preset) => preset.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)));
      setMessage(`Saved ${created.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save preset');
    }
  }

  function applyPreset(id: string) {
    const preset = presets.find((entry) => entry.id === id);
    if (!preset || readOnly) {
      return;
    }
    onChange?.(preset.parameters);
    setMessage(`Loaded ${preset.name}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onChange?.(draft);
    setEditing(false);
  }

  return (
    <div className={readOnly ? 'context-bar is-readonly' : 'context-bar'}>
      <span className="context-bar__label">Params</span>
      {editing && !readOnly ? (
        <form className="context-bar__form" onSubmit={handleSubmit}>
          <label>temp<input type="number" step="0.01" min="0" max="2" value={draft.temperature ?? ''} onChange={(event) => setDraft({ ...draft, temperature: event.target.value ? Number(event.target.value) : null })} /></label>
          <label>top_p<input type="number" step="0.01" min="0" max="1" value={draft.top_p ?? ''} onChange={(event) => setDraft({ ...draft, top_p: event.target.value ? Number(event.target.value) : null })} /></label>
          <label>max_tok<input type="number" min="1" value={draft.max_tokens ?? ''} onChange={(event) => setDraft({ ...draft, max_tokens: event.target.value ? Number(event.target.value) : null })} /></label>
          <label>quant<input value={draft.quantization_level ?? ''} onChange={(event) => setDraft({ ...draft, quantization_level: event.target.value || null })} /></label>
          <label className="context-bar__toggle"><input type="checkbox" checked={Boolean(draft.stream)} onChange={(event) => setDraft({ ...draft, stream: event.target.checked })} /> stream</label>
          <button type="submit">Apply</button>
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <>
          <button type="button" className="param-chip" disabled={readOnly} onClick={() => setEditing(true)}><span>temp</span><b>{paramValue(params.temperature)}</b></button>
          <button type="button" className="param-chip" disabled={readOnly} onClick={() => setEditing(true)}><span>top_p</span><b>{paramValue(params.top_p)}</b></button>
          <button type="button" className="param-chip" disabled={readOnly} onClick={() => setEditing(true)}><span>max_tok</span><b>{paramValue(params.max_tokens)}</b></button>
          <button type="button" className="param-chip" disabled={readOnly} onClick={() => setEditing(true)}><span>stream</span><b>{paramValue(params.stream)}</b></button>
          <button type="button" className="param-chip" disabled={readOnly} onClick={() => setEditing(true)}><span>quant</span><b>{paramValue(params.quantization_level)}</b></button>
        </>
      )}
      <div className="context-bar__spacer" />
      {message ? <span className="context-bar__message">{message}</span> : null}
      {!readOnly ? (
        <>
          <select value="" onChange={(event) => applyPreset(event.target.value)} aria-label="Load preset">
            <option value="">Load preset</option>
            {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
          <button type="button" className="btn btn--ghost" onClick={handleSavePreset}>Save preset</button>
        </>
      ) : null}
    </div>
  );
}
