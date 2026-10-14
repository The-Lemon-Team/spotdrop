import React, { memo } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = memo(function SearchBar({ value, onChange }) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <Search className="w-5 h-5 text-[#00E5FF]" />
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search title, artist, album, or #tag..."
        className="w-full pl-11 pr-10 py-3 bg-[#161822] hover:bg-[#1A1D2A] focus:bg-[#1A1D2A] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl text-[#F3F4F6] placeholder-[#8E95A5] text-sm font-medium transition-all outline-none shadow-inner"
      />

      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E95A5] hover:text-[#F3F4F6] transition-colors cursor-pointer"
          title="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});
