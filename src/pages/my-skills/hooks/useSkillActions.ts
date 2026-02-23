import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { InstalledSkill } from '../../../types';

interface CommandResult {
  success: boolean;
  message: string;
}

/**
 * Hook for managing active skills actions like delete, view, update
 */
export const useSkillActions = (
  scanLocalSkills: () => Promise<void>,
  showToast: (success: boolean, message: string) => void,
  t: (key: string, options?: any) => string
) => {
  const [selectedSkill, setSelectedSkill] = useState<InstalledSkill | null>(null);
  const [showSkillDrawer, setShowSkillDrawer] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState<InstalledSkill | null>(null);
  const [selectedDeletePaths, setSelectedDeletePaths] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);

  // View skill — Drawer handles its own data fetching
  const handleViewSkill = useCallback((skill: InstalledSkill) => {
    setSelectedSkill(skill);
    setShowSkillDrawer(true);
  }, []);

  const closeSkillDrawer = useCallback(() => {
    setShowSkillDrawer(false);
    setSelectedSkill(null);
  }, []);

  // 卸载逻辑
  const handleUninstall = useCallback((skill: InstalledSkill) => {
    const paths = skill.localPaths || [skill.localPath];
    setDeleteTarget(skill);
    setSelectedDeletePaths(new Set(paths));
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
    setSelectedDeletePaths(new Set());
  }, []);

  const toggleDeletePath = useCallback((path: string) => {
    setSelectedDeletePaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || selectedDeletePaths.size === 0) return;

    setIsDeleting(true);
    try {
      const result = await invoke<CommandResult>('uninstall_skill', {
        request: { skillPaths: Array.from(selectedDeletePaths) }
      });

      if (result.success) {
        showToast(true, `${deleteTarget.name} ${t('deleteSuccess')}`);
        await scanLocalSkills();
      } else {
        showToast(false, `${t('deleteError')}: ${result.message}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      showToast(false, `${t('deleteError')}: ${errMsg}`);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      setSelectedDeletePaths(new Set());
    }
  }, [deleteTarget, selectedDeletePaths, scanLocalSkills, showToast, t]);

  // 更新逻辑 (需要注入 reinstallSkill)
  const handleSingleUpdate = useCallback(async (skillId: string, reinstallSkill: (id: string) => Promise<boolean>) => {
    setUpdatingSkillId(skillId);
    try {
      const success = await reinstallSkill(skillId);
      showToast(success, success ? t('updateSuccess') : t('updateFailed'));
      await scanLocalSkills();
    } catch {
      showToast(false, t('updateFailed'));
    } finally {
      setUpdatingSkillId(null);
    }
  }, [showToast, t, scanLocalSkills]);

  return {
    // View state
    selectedSkill,
    showSkillDrawer,
    handleViewSkill,
    closeSkillDrawer,
    // Delete state
    deleteTarget,
    selectedDeletePaths,
    isDeleting,
    handleUninstall,
    closeDeleteModal,
    toggleDeletePath,
    handleConfirmDelete,
    // Update state
    updatingSkillId,
    handleSingleUpdate
  };
};

