'use client';

import React from 'react';
import { NewsCategory } from '@/lib/types';
import { Search, SlidersHorizontal } from 'lucide-react';

export type FilterCategory = 'all' | NewsCategory;

interface NewsFilterChipsProps {
  selectedCategory: FilterCategory;
  onSelectCategory: (cat: FilterCategory) => void;
  categoryCounts: Record<FilterCategory, number>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pollution', label: 'Pollution' },
  { id: 'government', label: 'Government Action' },
  { id: 'legal', label: 'Legal & NGT' },
  { id: 'local', label: 'Local' },
];

export function NewsFilterChips({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  searchQuery,
  onSearchChange,
}: NewsFilterChipsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden sm:flex items-center text-xs text-[#8A9BB4] mr-1">
          <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-[#22D3EE]" />
          Filter:
        </div>

        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] ?? 0;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                isSelected
                  ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE] shadow-[0_0_12px_rgba(34,211,238,0.2)] font-semibold'
                  : 'border-[#1E2C42] bg-[#121C2E] text-[#8A9BB4] hover:border-[#1E2C42]/80 hover:bg-[#1A263D] hover:text-[#E6EDF7]'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                  isSelected
                    ? 'bg-[#22D3EE]/25 text-[#22D3EE]'
                    : 'bg-[#0B1220] text-[#8A9BB4]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-64">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-3.5 w-3.5 text-[#8A9BB4]" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search headlines or keywords..."
          className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] py-1.5 pl-9 pr-3 text-xs text-[#E6EDF7] placeholder-[#8A9BB4]/60 transition-colors focus:border-[#22D3EE] focus:bg-[#0B1220] focus:outline-none focus:ring-1 focus:ring-[#22D3EE]"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-[#8A9BB4] hover:text-[#E6EDF7]"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default NewsFilterChips;
