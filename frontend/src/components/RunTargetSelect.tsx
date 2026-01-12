import { useEffect, useState } from 'react';

import { TargetRecord, listTargets } from '../services/targets-api.js';

interface RunTargetSelectProps {
  value: string;
  onChange: (value: string) => void;
  onTargetsLoaded?: (targets: TargetRecord[]) => void;
}

export function RunTargetSelect({ value, onChange, onTargetsLoaded }: RunTargetSelectProps) {
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    listTargets(includeArchived ? 'all' : 'active')
      .then((data) => {
        setTargets(data);
        onTargetsLoaded?.(data);
      })
      .catch(() => setTargets([]));
  }, [includeArchived, onTargetsLoaded]);

  useEffect(() => {
    if (!value) {
      return;
    }
    const selected = targets.find((target) => target.id === value);
    if (selected && selected.connectivity_status !== 'ok') {
      onChange('');
    }
  }, [targets, value, onChange]);

  return (
    <div className="field">
      <label>
        Target
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select a target</option>
          {targets.map((target) => (
            <option
              key={target.id}
              value={target.id}
              disabled={target.connectivity_status !== 'ok'}
            >
              {target.name}
              {target.connectivity_status !== 'ok' ? ' (unavailable)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.target.checked)}
        />
        Include archived targets
      </label>
    </div>
  );
}
