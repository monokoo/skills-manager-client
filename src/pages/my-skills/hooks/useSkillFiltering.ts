import { useState, useMemo, useCallback } from 'react';
import type { InstalledSkill } from '../../../types';

export type TabType = 'all' | 'system' | 'project';
export type SortBy = 'name' | 'installDate';
export type SortDir = 'asc' | 'desc';

/**
 * Hook for managing skill filtering and sorting logic
 */
export const useSkillFiltering = (installedSkills: InstalledSkill[]) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const setTabAndClearQuery = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const toggleSort = useCallback((field: SortBy) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  }, [sortBy]);

  const filteredSkills = useMemo(() => {
    return installedSkills
      .filter(skill => {
        const matchesTab = activeTab === 'all' || skill.type === activeTab;
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query ||
          skill.name.toLowerCase().includes(query) ||
          (skill.description || '').toLowerCase().includes(query);
        return matchesTab && matchesSearch;
      })
      .sort((a, b) => {
        if (!sortBy) return 0;
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
        if (sortBy === 'installDate') return ((a.installDate || 0) - (b.installDate || 0)) * dir;
        return 0;
      });
  }, [installedSkills, activeTab, searchQuery, sortBy, sortDir]);

  return {
    activeTab,
    setActiveTab: setTabAndClearQuery,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortDir,
    toggleSort,
    filteredSkills
  };
};
