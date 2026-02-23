import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Plus, RefreshCw, Package, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Trash2, X, CheckSquare, Square, CheckCircle, XCircle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Components
import { SearchBox } from '../components/ui/SearchBox';
import { StickyHeader } from '../components/ui/StickyHeader';
import { SkillRow } from './my-skills/components/SkillRow';
import { MySkillDrawer } from './my-skills/components/MySkillDrawer';
import { DeletePathsModal } from './my-skills/components/DeletePathsModal';
import { ImportSkillModal } from './my-skills/components/ImportSkillModal';

// Hooks & Store
import { useSkillStore } from '../store/useSkillStore';
import { useSkillSelection } from './my-skills/hooks/useSkillSelection';
import { useSkillFiltering, type TabType, type SortBy } from './my-skills/hooks/useSkillFiltering';
import { useSkillActions } from './my-skills/hooks/useSkillActions';
import { useSkillImport } from './my-skills/hooks/useSkillImport';

// Tab 配置：颜色标记
const TAB_COLORS: Record<TabType, string> = {
  all: 'bg-slate-400',
  system: 'bg-emerald-400',
  project: 'bg-amber-400',
};

const MySkills = () => {
  const { t } = useTranslation();
  const store = useSkillStore();

  // ── Toast 状态 ──────────────────────────────────────────────
  const [toast, setToast] = useState<{ show: boolean; success: boolean; message: string }>({
    show: false, success: false, message: '',
  });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((success: boolean, message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, success, message });
    toastTimerRef.current = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  }, []);

  // ── 1. 筛选 & 排序 ─────────────────────────────────────────
  const {
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    sortBy, sortDir, toggleSort,
    filteredSkills,
  } = useSkillFiltering(store.installedSkills);

  // ── 2. 选择逻辑 ────────────────────────────────────────────
  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useSkillSelection();

  // Tab 切换时自动清除选择（跨 Hook 协调）
  useEffect(() => {
    clearSelection();
  }, [activeTab, clearSelection]);

  // ── 3. 操作 Hooks ─────────────────────────────────────────
  const {
    selectedSkill, showSkillDrawer, handleViewSkill, closeSkillDrawer,
    deleteTarget, selectedDeletePaths, isDeleting, handleUninstall, closeDeleteModal, toggleDeletePath, handleConfirmDelete,
    updatingSkillId, handleSingleUpdate,
  } = useSkillActions(store.scanLocalSkills, showToast, t);

  const importFlow = useSkillImport(store, showToast, t);

  // ── 4. 初始加载 ───────────────────────────────────────────
  useEffect(() => {
    store.scanLocalSkills();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. 稳定的 onUpdate 回调（避免破坏 SkillRow 的 memo）───
  const handleUpdate = useCallback((id: string) => {
    handleSingleUpdate(id, store.reinstallSkill);
  }, [handleSingleUpdate, store.reinstallSkill]);

  // ── 6. 批量删除 ───────────────────────────────────────────
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const handleBatchDelete = useCallback(async () => {
    if (isBatchDeleting || selectedIds.size === 0) return;
    setIsBatchDeleting(true);

    let successCount = 0;
    let failCount = 0;

    for (const id of Array.from(selectedIds)) {
      const skill = store.installedSkills.find(s => s.id === id);
      if (!skill) continue;
      const paths = skill.localPaths || [skill.localPath];
      try {
        const result: any = await invoke('uninstall_skill', {
          request: { skillPaths: paths },
        });
        if (result.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    showToast(failCount === 0, t('batchDeleteComplete', { success: successCount, fail: failCount }));
    clearSelection();
    await store.scanLocalSkills();
    setIsBatchDeleting(false);
  }, [isBatchDeleting, selectedIds, store, showToast, clearSelection, t]);

  // ── 7. 批量更新 ───────────────────────────────────────────
  const updatableSelected = useMemo(() =>
    Array.from(selectedIds).filter(id => {
      const skill = store.installedSkills.find(s => s.id === id);
      return skill?.sourceUrl;
    }), [selectedIds, store.installedSkills]);

  const [updateResult, setUpdateResult] = useState<{ show: boolean; success: string[]; failed: string[] } | null>(null);
  const handleBatchUpdate = useCallback(async () => {
    if (updatableSelected.length === 0) return;
    const result = await store.updateSelectedSkills(updatableSelected);
    setUpdateResult({ show: true, ...result });
    clearSelection();
    setTimeout(() => setUpdateResult(null), 5000);
  }, [updatableSelected, store, clearSelection]);

  // ── 8. Tab 计数 ───────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    all: store.installedSkills.length,
    system: store.installedSkills.filter(s => s.type === 'system').length,
    project: store.installedSkills.filter(s => s.type === 'project').length,
  }), [store.installedSkills]);

  // ── 排序图标组件 ──────────────────────────────────────────
  const SortIcon = ({ field }: { field: SortBy }) => {
    if (sortBy !== field) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div className="relative">
      {/* ── Toast 通知 ──────────────────────────────────────── */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-xl border border-white/20"
            style={{ background: toast.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}
          >
            {toast.success ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-500" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 批量更新结果通知 ──────────────────────────────── */}
      <AnimatePresence>
        {updateResult?.show && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-xl border border-white/20 bg-emerald-500/10"
          >
            <span className="text-sm font-medium">
              {t('batchUpdateComplete', {
                success: updateResult.success.length,
                fail: updateResult.failed.length,
              })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <StickyHeader className="space-y-4">
        {/* Header Section */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shrink-0">
              <Package size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t('mySkills')}</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {t('installedCount', { count: store.installedSkills.length })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 h-10 sm:h-12 rounded-2xl border border-gray-200/60 dark:border-white/10
                bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium
                hover:bg-white/80 dark:hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-200 shadow-sm"
              onClick={() => store.checkSkillUpdates()}
              disabled={store.isCheckingUpdates}
            >
              <motion.div
                animate={store.isCheckingUpdates ? { rotate: 360 } : { rotate: 0 }}
                transition={store.isCheckingUpdates ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
              >
                <RefreshCw size={14} className={store.isCheckingUpdates ? 'text-emerald-500' : ''} />
              </motion.div>
              <span className="hidden sm:inline">{t('checkUpdates')}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 h-10 sm:h-12 rounded-2xl font-semibold text-xs sm:text-sm text-white
                bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20"
              onClick={() => importFlow.setShowImportModal(true)}
            >
              <Plus size={16} />
              <span>{t('importSkill')}</span>
            </motion.button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="tabs tabs-boxed bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-gray-200/60 dark:border-white/10">
            {(['all', 'system', 'project'] as TabType[]).map(tab => (
              <a
                key={tab}
                role="tab"
                className={`tab transition-all duration-300 rounded-lg text-sm font-medium ${
                  activeTab === tab
                  ? 'bg-white dark:bg-white/10 text-emerald-600 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${TAB_COLORS[tab]}`} />
                {t(tab)} ({tabCounts[tab]})
              </a>
            ))}
          </div>

          <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder={t('searchPlaceholder')} />
        </div>

        {/* Contextual Batch Action Row */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: { duration: 0.25 }, opacity: { duration: 0.2 } }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/10 rounded-2xl">
                <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-xs font-bold">{selectedIds.size}</div>
                <button
                    className="text-xs font-medium text-gray-500 px-2 rounded-lg hover:bg-black/5"
                    onClick={() => toggleSelectAll(filteredSkills.map(s => s.id))}
                >
                    {selectedIds.size === filteredSkills.length ? t('deselectAll') : t('selectAll')}
                </button>
                <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
                <button
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  disabled={updatableSelected.length === 0}
                  onClick={handleBatchUpdate}
                >
                  <Download size={14} />
                  <span className="hidden md:inline">{t('batchUpdate')}</span>
                </button>
                <button
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                  onClick={handleBatchDelete}
                  disabled={isBatchDeleting}
                >
                  {isBatchDeleting && <span className="loading loading-spinner loading-xs" />}
                  <Trash2 size={14} />
                  <span className="hidden md:inline">{t('batchDelete')}</span>
                </button>
                <button className="p-1 hover:bg-black/5 rounded ml-auto" onClick={clearSelection}><X size={14} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </StickyHeader>

      {/* Main List Area */}
      <div className="mt-4 min-h-[400px]">
        {filteredSkills.length > 0 ? (
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-sm overflow-hidden overflow-x-auto">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/5 border-b border-gray-200/60 dark:border-white/10 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[700px]">
              <button className="shrink-0" onClick={() => toggleSelectAll(filteredSkills.map(s => s.id))}>
                {selectedIds.size === filteredSkills.length ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} />}
              </button>
              <button className="flex-1 flex items-center gap-1" onClick={() => toggleSort('name')}>
                {t('name')} <SortIcon field="name" />
              </button>
              <div className="w-24 text-center shrink-0">{t('sourceHeader')}</div>
              <button className="w-40 flex justify-center items-center gap-1 shrink-0" onClick={() => toggleSort('installDate')}>
                {t('installedHeader')} <SortIcon field="installDate" />
              </button>
              <div className="w-20 text-center shrink-0">{t('statusHeader')}</div>
              <div className="w-28 text-right pr-4 shrink-0">{t('actions')}</div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredSkills.map(skill => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  isSelected={selectedIds.has(skill.id)}
                  isUpdating={updatingSkillId === skill.id}
                  onToggleSelect={toggleSelect}
                  onView={handleViewSkill}
                  onUninstall={handleUninstall}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-8"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/10 dark:to-white/5 border border-gray-200/60 dark:border-white/10 flex items-center justify-center mb-6 shadow-sm">
              {activeTab === 'project' ? (
                <Package size={32} className="text-amber-400" />
              ) : (
                <Package size={32} className="text-gray-300 dark:text-gray-600" />
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {t(`noSkillsFound_${activeTab}`)}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mb-6">
              {activeTab === 'project'
                ? t('emptyProjectHint')
                : activeTab === 'system'
                  ? t('emptySystemHint')
                  : t('emptyAllHint')}
            </p>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-5 h-10 rounded-xl font-medium text-sm text-white
                  bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/20
                  hover:shadow-lg hover:shadow-emerald-500/30 transition-shadow"
                onClick={() => importFlow.setShowImportModal(true)}
              >
                <Plus size={16} />
                {t('importSkill')}
              </motion.button>
              {activeTab === 'project' && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl font-medium text-sm
                    border border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-white/5
                    text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                  onClick={() => window.location.href = '/settings'}
                >
                  {t('configProjectPath')}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals Section */}
      <MySkillDrawer
        isOpen={showSkillDrawer}
        skill={selectedSkill}
        onClose={closeSkillDrawer}
        onUpdate={handleUpdate}
        isUpdating={updatingSkillId === (selectedSkill?.id || '')}
      />

      <DeletePathsModal
        isOpen={!!deleteTarget}
        skill={deleteTarget}
        selectedPaths={selectedDeletePaths}
        isDeleting={isDeleting}
        onClose={closeDeleteModal}
        onTogglePath={toggleDeletePath}
        onConfirm={handleConfirmDelete}
      />

      <ImportSkillModal
        isOpen={importFlow.showImportModal}
        onClose={importFlow.closeImportModal}
        importType={importFlow.importType}
        setImportType={importFlow.setImportType}
        importUrl={importFlow.importUrl}
        setImportUrl={importFlow.setImportUrl}
        importPath={importFlow.importPath}
        setImportPath={importFlow.setImportPath}
        importLevel={importFlow.importLevel}
        setImportLevel={importFlow.setImportLevel}
        selectedSkillPaths={importFlow.selectedSkillPaths}
        setSelectedSkillPaths={importFlow.setSelectedSkillPaths}
        formError={importFlow.formError}
        setFormError={importFlow.setFormError}
        analysisError={importFlow.analysisError}
        setAnalysisError={importFlow.setAnalysisError}
        isAnalyzing={store.isAnalyzing}
        isImporting={importFlow.isImporting}
        analysisResult={store.analysisResult}
        projectPaths={store.projectPaths}
        selectedProjectIndices={[store.selectedProjectIndex]}
        onAnalyzeGitHub={importFlow.handleAnalyzeGitHub}
        onAnalyzeLocal={importFlow.handleAnalyzeLocal}
        onImport={importFlow.handleImport}
        onClearAnalysis={store.clearAnalysisResult}
        onProjectIndicesChange={(indices) => store.setSelectedProjectIndex(indices[0] ?? 0)}
      />
    </div>
  );
};

export default MySkills;
