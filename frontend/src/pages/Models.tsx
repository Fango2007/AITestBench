import { useEffect, useState } from 'react';

import { apiGet } from '../services/api.js';

export function Models() {
  const [models, setModels] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    apiGet<Record<string, unknown>[]>('/models').then(setModels).catch(() => setModels([]));
  }, []);

  return (
    <section className="page">
      <h1>Models</h1>
      <ul>
        {models.map((model, index) => (
          <li key={index}>{JSON.stringify(model)}</li>
        ))}
      </ul>
    </section>
  );
}
