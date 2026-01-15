import { useEffect, useState } from 'react';

import { InferenceServerRecord, listInferenceServers } from '../services/inference-servers-api.js';

interface RunInferenceServerSelectProps {
  value: string;
  onChange: (value: string) => void;
  onServersLoaded?: (servers: InferenceServerRecord[]) => void;
}

export function RunInferenceServerSelect({
  value,
  onChange,
  onServersLoaded
}: RunInferenceServerSelectProps) {
  const [servers, setServers] = useState<InferenceServerRecord[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    listInferenceServers(includeArchived ? {} : { archived: false })
      .then((data) => {
        setServers(data);
        onServersLoaded?.(data);
      })
      .catch(() => setServers([]));
  }, [includeArchived, onServersLoaded]);

  useEffect(() => {
    if (!value) {
      return;
    }
    const selected = servers.find(
      (server) => server.inference_server.server_id === value
    );
    if (selected && !selected.inference_server.active) {
      onChange('');
    }
  }, [servers, value, onChange]);

  return (
    <div className="field">
      <label>
        Inference server
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select an inference server</option>
          {servers.map((server) => (
            <option
              key={server.inference_server.server_id}
              value={server.inference_server.server_id}
              disabled={!server.inference_server.active || server.inference_server.archived}
            >
              {server.inference_server.display_name}
              {!server.inference_server.active ? ' (inactive)' : ''}
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
        Include archived servers
      </label>
    </div>
  );
}
