import React, { memo, useMemo } from 'react';

interface TagsBarProps {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  availableTags?: string[];
}

const BASE_TAGS = ['#all', '#favorites', '#summer', '#studio', '#spring', '#library', '#trance'];

export const TagsBar: React.FC<TagsBarProps> = memo(function TagsBar({
  selectedTag,
  onSelectTag,
  availableTags = [],
}) {
  const allTags = useMemo(() => {
    return Array.from(new Set([...BASE_TAGS, ...availableTags]));
  }, [availableTags]);

  return (
    <div className="flex items-center space-x-2 overflow-x-auto py-1 scrollbar-none no-scrollbar">
      {allTags.map((tag) => {
        const isSelected = selectedTag === tag;
        return (
          <button
            key={tag}
            onClick={() => onSelectTag(tag)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
              isSelected
                ? 'bg-[#00E5FF] text-[#0D0E15] border-[#00E5FF] shadow-md shadow-[#00E5FF]/20 font-bold'
                : 'bg-[#161822] text-[#B2B9C8] hover:text-[#F3F4F6] border-[#2B2F42] hover:border-[#00E5FF]/40'
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
});
