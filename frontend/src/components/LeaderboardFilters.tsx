import { useState } from 'react';

export interface LeaderboardFilterValues {
  date_from: string;
  date_to: string;
  tags: string[];
}

interface LeaderboardFiltersProps {
  onApply: (filters: LeaderboardFilterValues) => void;
  onClear: () => void;
}

export function LeaderboardFilters({ onApply, onClear }: LeaderboardFiltersProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, '');
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  }

  function handleApply() {
    onApply({ date_from: dateFrom, date_to: dateTo, tags });
  }

  function handleClear() {
    setDateFrom('');
    setDateTo('');
    setTags([]);
    setTagInput('');
    onClear();
  }

  return (
    <div className="leaderboard-filters">
      <label>
        From
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </label>
      <label>
        To
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </label>
      <div className="filter-tags">
        <div className="tag-chips">
          {tags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
              <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} aria-label={`Remove tag ${tag}`}>×</button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === ',' || e.key === 'Enter') {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          onBlur={() => tagInput.trim() && addTag(tagInput)}
          placeholder="Filter by tag (press Enter or comma)"
        />
      </div>
      <div className="filter-actions">
        <button type="button" onClick={handleApply}>Apply</button>
        <button type="button" onClick={handleClear}>Clear</button>
      </div>
    </div>
  );
}
