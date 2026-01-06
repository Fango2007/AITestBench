import { useEffect, useState } from 'react';

import { apiGet } from '../services/api';

export function Profiles() {
  const [profiles, setProfiles] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    apiGet<Record<string, unknown>[]>('/profiles').then(setProfiles).catch(() => setProfiles([]));
  }, []);

  return (
    <section className="page">
      <h1>Profiles</h1>
      <ul>
        {profiles.map((profile, index) => (
          <li key={index}>{JSON.stringify(profile)}</li>
        ))}
      </ul>
    </section>
  );
}
