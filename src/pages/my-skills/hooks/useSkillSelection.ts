import { useState, useCallback } from 'react';

/**
 * Hook for managing skill selection state
 */
export const useSkillSelection = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback((allIds: string[]) => {
    if (selectedIds.size === allIds.length) {
      clearSelection();
    } else {
      selectAll(allIds);
    }
  }, [selectedIds.size, selectAll, clearSelection]);

  return {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    toggleSelectAll
  };
};
