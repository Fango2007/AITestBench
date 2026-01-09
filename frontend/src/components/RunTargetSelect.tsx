import { useEffect, useState } from 'react';

import { TargetRecord, listTargets } from '../services/targets-api';

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

  return (
    <div className="field">
      <label>
        Target
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select a target</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
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
