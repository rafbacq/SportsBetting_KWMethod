import React from 'react';

const ALL_CATEGORIES = ['All', 'Sports', 'Politics', 'Economics', 'Crypto', 'Finance', 'Weather', 'Culture', 'Tech', 'Other'];

export default function FilterBar({ active, onChange, categoryCounts = {} }) {
  return (
    <div className="filter-bar">
      {ALL_CATEGORIES.map((cat) => {
        const count = cat === 'All' ? null : categoryCounts[cat];
        if (cat !== 'All' && cat !== 'Other' && !count) return null;
        return (
          <button
            key={cat}
            className={`filter-chip ${active === cat ? 'filter-chip--active' : ''}`}
            onClick={() => onChange(cat)}
          >
            {cat}
            {count != null && <span className="filter-chip__count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
