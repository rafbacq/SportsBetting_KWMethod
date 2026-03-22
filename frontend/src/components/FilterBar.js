import React from 'react';

/**
 * Two-level filter: top-level categories + subcategories (e.g., Sports → Basketball).
 *
 * Props:
 *   activeCategory    — current top-level filter (e.g., 'All', 'Sports')
 *   activeSubcategory — current subcategory (e.g., 'Basketball', null for all)
 *   onCategoryChange  — callback(category)
 *   onSubcategoryChange — callback(subcategory)
 *   categoryCounts    — { Sports: 120, Politics: 45, ... }
 *   subcategoryCounts — { Basketball: 80, Hockey: 20, ... } (only when Sports selected)
 */
export default function FilterBar({
  activeCategory,
  activeSubcategory,
  onCategoryChange,
  onSubcategoryChange,
  categoryCounts = {},
  subcategoryCounts = {},
}) {
  const categories = ['All', ...Object.keys(categoryCounts).sort((a, b) =>
    (categoryCounts[b] || 0) - (categoryCounts[a] || 0)
  )];

  const subcategories = Object.keys(subcategoryCounts).sort((a, b) =>
    (subcategoryCounts[b] || 0) - (subcategoryCounts[a] || 0)
  );

  return (
    <div className="filter-bar">
      <div className="filter-bar__row">
        {categories.map((cat) => {
          const count = cat === 'All' ? null : categoryCounts[cat];
          return (
            <button
              key={cat}
              className={`filter-chip ${activeCategory === cat ? 'filter-chip--active' : ''}`}
              onClick={() => {
                onCategoryChange(cat);
                onSubcategoryChange(null);
              }}
            >
              {cat}
              {count != null && <span className="filter-chip__count">{count}</span>}
            </button>
          );
        })}
      </div>

      {subcategories.length > 0 && (
        <div className="filter-bar__row filter-bar__subcategories">
          <button
            className={`filter-chip filter-chip--sub ${!activeSubcategory ? 'filter-chip--active' : ''}`}
            onClick={() => onSubcategoryChange(null)}
          >
            All {activeCategory}
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub}
              className={`filter-chip filter-chip--sub ${activeSubcategory === sub ? 'filter-chip--active' : ''}`}
              onClick={() => onSubcategoryChange(sub)}
            >
              {sub}
              <span className="filter-chip__count">{subcategoryCounts[sub]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
