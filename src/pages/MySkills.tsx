import i18n from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { Trash2, Eye, FolderOpen, X, Github, HardDrive, Plus, ExternalLink, RefreshCw, AlertCircle, CheckCircle, Package, Calendar, Download, CheckSquare, Square } from 'lucide-react';
import type { InstalledSkill } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface CommandResult {
  success: boolean;
  message: string;
}

const MySkills = () => {
  const { t } = useTranslation();
  const {
    installedSkills,
    scanLocalSkills,
    importFromGithub,
    importFromLocal,
    updateSelectedSkills,
    checkSkillUpdates,
    reinstallSkill,
    isCheckingUpdates,
    isUpdating,
    analyzeGithubRepo,
    isAnalyzing,
    analysisResult,
    clearAnalysisResult,
    importSelectedSkills
  } = useSkillStore();
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'project'>('all');
  const [selectedSkill, setSelectedSkill] = useState<InstalledSkill | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [skillContent, setSkillContent] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'github' | 'local' | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importPath, setImportPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<Set<string>>(new Set());
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{show: boolean, success: boolean, message: string}>({show: false, success: false, message: ''});

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updateResult, setUpdateResult] = useState<{show: boolean, success: number, failed: number} | null>(null);
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleUninstall = async (skill: InstalledSkill) => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const result = await invoke<CommandResult>('uninstall_skill', {
        request: {
          skillPaths: skill.localPaths || [skill.localPath]
        }
      });

      if (result.success) {
        setDeleteResult({show: true, success: true, message: `${skill.name} ${t('deleteSuccess')}`});
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(skill.id);
          return next;
        });
        await scanLocalSkills();
      } else {
        setDeleteResult({show: true, success: false, message: `${t('deleteError')}: ${result.message}`});
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setDeleteResult({show: true, success: false, message: `${t('deleteError')}: ${errMsg}`});
    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteResult({show: false, success: false, message: ''}), 3000);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (isDeleting || selectedIds.size === 0) return;

    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const skill = installedSkills.find(s => s.id === id);
      if (!skill) continue;

      try {
        const result = await invoke<CommandResult>('uninstall_skill', {
          request: { skillPaths: skill.localPaths || [skill.localPath] }
        });
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setDeleteResult({
      show: true,
      success: failCount === 0,
      message: t('batchDeleteComplete', { success: successCount, fail: failCount })
    });
    setSelectedIds(new Set());
    await scanLocalSkills();
    setIsDeleting(false);
    setTimeout(() => setDeleteResult({show: false, success: false, message: ''}), 3000);
  };

  // 单个更新
  const handleSingleUpdate = async (skillId: string) => {
    setUpdatingSkillId(skillId);
    try {
      await reinstallSkill(skillId);
      setDeleteResult({
        show: true,
        success: true,
        message: t('updateSuccess')
      });
    } catch {
      setDeleteResult({
        show: true,
        success: false,
        message: t('updateFailed')
      });
    } finally {
      setUpdatingSkillId(null);
      setTimeout(() => setDeleteResult({show: false, success: false, message: ''}), 3000);
    }
  };

  useEffect(() => {
    scanLocalSkills();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSkills = installedSkills.filter(skill => {
    // Tab 过滤
    const matchesTab = activeTab === 'all' || skill.type === activeTab;
    
    // 搜索过滤 (名称或描述)
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      skill.name.toLowerCase().includes(query) || 
      skill.description.toLowerCase().includes(query);
      
    return matchesTab && matchesSearch;
  });

  const handleViewSkill = async (skill: InstalledSkill) => {
    setSelectedSkill(skill);
    setShowViewModal(true);

    try {
      const content = await invoke<string>('read_skill', {
        skillPath: skill.localPath
      });
      setSkillContent(content);
    } catch (error) {
      console.error('Failed to load skill content:', error);
      setSkillContent(`# ${skill.name}\n\n${skill.description}\n\n**${t('version')}**: ${skill.version}\n**${t('author')}**: ${skill.author}\n\n**${t('path')}**: ${skill.localPath}`);
    }
  };

  const handleAnalyze = async () => {
    if (!importUrl) return;
    setAnalysisError(null);
    try {
      const result = await analyzeGithubRepo(importUrl);
      if (result.success) {
        const allPaths = new Set(result.skills.map((s) => s.path));
        setSelectedSkillPaths(allPaths);
      } else {
        setAnalysisError(result.message);
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleSelectSkill = (path: string) => {
      const newSet = new Set(selectedSkillPaths);
      if (newSet.has(path)) {
          newSet.delete(path);
      } else {
          newSet.add(path);
      }
      setSelectedSkillPaths(newSet);
  };

  const toggleSelectAllSkills = () => {
      if (!analysisResult) return;
      if (selectedSkillPaths.size === analysisResult.skills.length) {
          setSelectedSkillPaths(new Set());
      } else {
          setSelectedSkillPaths(new Set(analysisResult.skills.map((s) => s.path)));
      }
  };

  const handleImport = async () => {
    if (isImporting) return;
    
    setIsImporting(true);
    setAnalysisError(null);

    try {
      let success = false;
      let msg = '';

      if (importType === 'github') {
        if (!importUrl.trim()) throw new Error(t('enterGithubUrl'));
        
        if (analysisResult && analysisResult.skills.length > 0) {
            // Import selected logic
            const selected = Array.from(selectedSkillPaths);
            if (selected.length === 0) {
                setAnalysisError("Please select at least one skill to import.");
                setIsImporting(false);
                return;
            }
            const result = await importSelectedSkills(analysisResult.tempPath, selected, importUrl);
            success = result.success;
            msg = result.message;
        } else {
            // Standard import
            const result = await importFromGithub(importUrl);
            success = result.success;
            msg = result.message || t('importSuccessGitHub');
        }
      } else if (importType === 'local') {
        if (!importPath.trim()) throw new Error(t('enterLocalPath'));
        const result = await importFromLocal(importPath);
        success = result.success;
        msg = result.message || t('importSuccessLocal');
      }

      if (success) {
          setDeleteResult({
            show: true, 
            success: true, 
            message: msg
          });
          setShowImportModal(false);
          setImportUrl('');
          setImportPath('');
          setImportType(null);
          clearAnalysisResult();
          setSelectedSkillPaths(new Set());
      } else {
          throw new Error(msg || 'Import failed');
      }
      
    } catch (error) {
      console.error('[UI] Import failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      // If analysis error, stay in modal
      if (analysisResult) {
          setAnalysisError(errMsg);
      } else {
          setDeleteResult({
            show: true, 
            success: false, 
            message: `${t('importError')}: ${errMsg}`
          });
      }
    } finally {
      setIsImporting(false);
      // Only clear toast if we set simple deleteResult (logic is a bit mixed here, but effectively keeps toast)
      if (!analysisResult) {
          setTimeout(() => setDeleteResult((prev) => ({ ...prev, show: false })), 3000);
      }
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportType(null);
    setImportUrl('');
    setImportPath('');
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'marketplace':
        return <Package size={14} className="text-primary" />;
      case 'github':
        return <Github size={14} className="text-base-content/60" />;
      case 'local':
        return <HardDrive size={14} className="text-base-content/60" />;
      default:
        return <FolderOpen size={14} className="text-base-content/60" />;
    }
  };

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'marketplace':
        return t('marketplace');
      case 'github':
        return 'GitHub';
      case 'local':
        return t('local');
      default:
        return t('unknown');
    }
  };

  // 多选操作
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSkills.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSkills.map(s => s.id)));
    }
  };

  const handleBatchUpdate = async () => {
    const idsToUpdate = Array.from(selectedIds);
    const result = await updateSelectedSkills(idsToUpdate);
    setUpdateResult({
      show: true,
      success: result.success.length,
      failed: result.failed.length
    });
    setSelectedIds(new Set());
    setTimeout(() => setUpdateResult(null), 5000);
  };

  // 获取可更新的选中 Skills
  const updatableSelected = Array.from(selectedIds).filter(id => {
    const skill = installedSkills.find(s => s.id === id);
    return skill?.sourceUrl;
  });

  return (
    <div className="space-y-4">
      {/* Toast Notifications */}
      {deleteResult.show && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert ${deleteResult.success ? 'alert-success' : 'alert-error'} shadow-lg rounded-2xl`}>
            <span>{deleteResult.message}</span>
          </div>
        </div>
      )}

      {updateResult?.show && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-info shadow-lg rounded-2xl">
            <span>
              {t('batchUpdateComplete', { success: updateResult.success, fail: updateResult.failed })}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl">
            <Package size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('mySkills')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('installedCount', { count: installedSkills.length })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative group overflow-hidden">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40 transition-colors group-focus-within:text-primary">
              {importType === 'local' ? <FolderOpen size={16} /> : <Eye size={16} className="hidden" />}
              {/* 这里借用一下图标 */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={t('searchPlaceholder') || "搜索技能名称或描述..."}
              className="input input-sm pl-10 pr-4 w-64 bg-base-100 hover:bg-base-200 focus:bg-base-100 border-base-200 focus:border-primary/50 rounded-xl transition-all duration-300 placeholder:text-base-content/30 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-content/30 hover:text-base-content/60"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            className="btn btn-ghost btn-sm gap-2 rounded-xl border border-transparent hover:border-base-300"
            onClick={() => checkSkillUpdates()}
            disabled={isCheckingUpdates}
          >
            {isCheckingUpdates ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <RefreshCw size={16} />
            )}
            {t('checkUpdates')}
          </button>
          <button
            className="btn btn-primary gap-2 rounded-xl shadow-lg shadow-primary/25"
            onClick={() => setShowImportModal(true)}
          >
            <Plus size={18} />
            {t('importSkill')}
          </button>
        </div>
      </div>

      {/* Tabs & Batch Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div role="tablist" className="tabs tabs-boxed bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/60 dark:border-white/10">
          <a
            role="tab"
            className={`tab transition-all duration-300 rounded-lg text-sm font-medium ${
              activeTab === 'all' 
              ? 'bg-white dark:bg-white/10 text-blue-500 shadow-sm ring-1 ring-gray-200/50 dark:ring-white/10' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('all')}
          >
            {t('all')} ({installedSkills.length})
          </a>
          <a
            role="tab"
            className={`tab transition-all duration-300 rounded-lg text-sm font-medium ${
              activeTab === 'system' 
              ? 'bg-white dark:bg-white/10 text-blue-500 shadow-sm ring-1 ring-gray-200/50 dark:ring-white/10' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('system')}
          >
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'system' ? 'bg-primary' : 'bg-base-content/20'}`} />
              {t('systemLevel')} ({installedSkills.filter(s => s.type === 'system').length})
            </span>
          </a>
          <a
            role="tab"
            className={`tab transition-all duration-300 rounded-lg text-sm font-medium ${
              activeTab === 'project' 
              ? 'bg-white dark:bg-white/10 text-blue-500 shadow-sm ring-1 ring-gray-200/50 dark:ring-white/10' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('project')}
          >
             <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'project' ? 'bg-accent' : 'bg-base-content/20'}`} />
              {t('projectLevel')} ({installedSkills.filter(s => s.type === 'project').length})
            </span>
          </a>
        </div>

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-base-content/60">
              {t('selectedCount', { count: selectedIds.size })}
            </span>
            <button
              className="btn btn-sm btn-primary gap-2 rounded-lg"
              onClick={handleBatchUpdate}
              disabled={isUpdating || updatableSelected.length === 0}
            >
              {isUpdating ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download size={14} />
              )}
              {t('batchUpdate')}
              {updatableSelected.length > 0 && ` (${updatableSelected.length})`}
            </button>
            <button
              className="btn btn-sm btn-error btn-outline gap-2 rounded-lg"
              onClick={handleBatchDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Trash2 size={14} />
              )}
              {t('batchDelete')}
            </button>
            <button
              className="btn btn-sm btn-ghost rounded-lg"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {/* Skills List */}
      {filteredSkills.length > 0 ? (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10 overflow-hidden">
          {/* List Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/5 border-b border-gray-200/60 dark:border-white/10 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <button
              className="shrink-0"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === filteredSkills.length ? (
                <CheckSquare size={16} className="text-primary" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <div className="flex-1 min-w-0">{t('name')}</div>
            <div className="w-24 text-center hidden sm:block">{t('sourceHeader')}</div>
            <div className="w-24 text-center hidden md:block">{t('installedHeader')}</div>
            <div className="w-20 text-center hidden lg:block">{t('statusHeader')}</div>
            <div className="w-40 text-right">{t('actions')}</div>
          </div>

          {/* List Items */}
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                  selectedIds.has(skill.id) ? 'bg-blue-50 dark:bg-blue-500/5' : ''
                }`}
              >
                {/* Checkbox */}
                <button
                  className="shrink-0"
                  onClick={() => toggleSelect(skill.id)}
                >
                  {selectedIds.has(skill.id) ? (
                    <CheckSquare size={16} className="text-primary" />
                  ) : (
                    <Square size={16} className="text-base-content/40" />
                  )}
                </button>

                {/* Name & Description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{skill.name}</span>
                    {skill.version && (
                      <span className="badge badge-ghost badge-xs font-mono">v{skill.version}</span>
                    )}
                    {skill.type === 'system' ? (
                      <span className="badge badge-neutral badge-xs">{t('system')}</span>
                    ) : (
                      <span className="badge badge-accent badge-outline badge-xs">{t('project')}</span>
                    )}
                    {skill.hasUpdate && (
                      <span className="badge badge-warning badge-xs gap-0.5">
                        <RefreshCw size={8} />
                        {t('updateAvailable')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-base-content/50 truncate" title={skill.description}>
                    {skill.description}
                  </p>
                </div>

                {/* Source - Clickable */}
                <div className="w-24 hidden sm:flex items-center justify-center">
                  {skill.sourceUrl ? (
                    <button
                      className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                      onClick={() => invoke('open_url', { url: skill.sourceUrl })}
                      title={skill.sourceUrl}
                    >
                      {getSourceIcon(skill.source)}
                      <span>{getSourceLabel(skill.source)}</span>
                      <ExternalLink size={10} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-base-content/60">
                      {getSourceIcon(skill.source)}
                      <span>{getSourceLabel(skill.source)}</span>
                    </div>
                  )}
                </div>

                {/* Install Date */}
                <div className="w-24 hidden md:flex items-center justify-center gap-1 text-xs text-base-content/50">
                  <Calendar size={12} />
                  <span>{formatDate(skill.installDate)}</span>
                </div>

                {/* Status */}
                <div className="w-20 hidden lg:flex justify-center">
                  {skill.status === 'safe' && (
                    <span className="badge badge-success badge-xs gap-0.5">
                      <CheckCircle size={10} />
                      {t('safe')}
                    </span>
                  )}
                  {skill.status === 'unsafe' && (
                    <span className="badge badge-error badge-xs gap-0.5">
                      <AlertCircle size={10} />
                      {t('risk')}
                    </span>
                  )}
                </div>

                {/* Actions - Increased spacing */}
                <div className="w-40 flex items-center justify-end gap-2">
                  {/* Update button for skills with sourceUrl */}
                  {skill.sourceUrl && (
                    <button
                      className="btn btn-ghost btn-xs gap-1 rounded-lg text-primary hover:bg-primary/10"
                      onClick={() => handleSingleUpdate(skill.id)}
                      disabled={updatingSkillId === skill.id}
                      title={t('update')}
                    >
                      {updatingSkillId === skill.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Download size={14} />
                      )}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-xs rounded-lg"
                    onClick={() => handleViewSkill(skill)}
                    title={t('view')}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error rounded-lg hover:bg-error/10"
                    onClick={() => handleUninstall(skill)}
                    disabled={isDeleting}
                    title={t('remove')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10 p-12 text-center shadow-sm animate-fade-in">
          <FolderOpen size={48} strokeWidth={1} className="mx-auto mb-3 opacity-30 text-primary" />
          <p className="text-base-content/70 font-medium">
            {searchQuery 
              ? t('noSearchResults', { query: searchQuery }) 
              : t('noSkillsFound', { context: activeTab })
            }
          </p>
          <p className="text-xs mt-2 text-base-content/40">
            {searchQuery ? t('clearSearchTip') : t('installTip')}
          </p>
          {searchQuery && (
            <button 
              className="btn btn-ghost btn-sm mt-4 rounded-xl text-primary"
              onClick={() => setSearchQuery('')}
            >
              {t('clearSearch')}
            </button>
          )}
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedSkill && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-base-200 bg-base-100 shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  {selectedSkill.name}
                  {selectedSkill.version && (
                    <span className="badge badge-ghost badge-sm font-mono">v{selectedSkill.version}</span>
                  )}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-xs text-base-content/50 font-mono">
                    {selectedSkill.localPath}
                  </span>
                </div>
                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-base-content/60">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(selectedSkill.installDate)}
                  </span>
                  {selectedSkill.sourceUrl ? (
                    <button
                      className="flex items-center gap-1 text-primary hover:underline"
                      onClick={() => invoke('open_url', { url: selectedSkill.sourceUrl })}
                    >
                      {getSourceIcon(selectedSkill.source)}
                      {getSourceLabel(selectedSkill.source)}
                      <ExternalLink size={10} />
                    </button>
                  ) : (
                    <span className="flex items-center gap-1">
                      {getSourceIcon(selectedSkill.source)}
                      {getSourceLabel(selectedSkill.source)}
                    </span>
                  )}
                  {selectedSkill.author && (
                    <span className="flex items-center gap-1">
                      {t('author')}: {selectedSkill.author}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedSkill(null);
                  setSkillContent('');
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-base-200 p-6">
              <div className="prose prose-sm max-w-none bg-base-100 p-6 rounded-xl shadow-sm">
                <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-mono bg-transparent">
                  {skillContent || t('loading')}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-base-200 bg-base-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                {selectedSkill.sourceUrl && (
                  <>
                    <button
                      className="btn btn-ghost btn-sm gap-2 rounded-xl"
                      onClick={() => invoke('open_url', { url: selectedSkill.sourceUrl })}
                    >
                      <ExternalLink size={14} />
                      {t('viewSource')}
                    </button>
                    <button
                      className="btn btn-primary btn-sm gap-2 rounded-xl"
                      onClick={() => handleSingleUpdate(selectedSkill.id)}
                      disabled={updatingSkillId === selectedSkill.id}
                    >
                      {updatingSkillId === selectedSkill.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Download size={14} />
                      )}
                      {t('reDownload')}
                    </button>
                  </>
                )}
              </div>
              <button
                className="btn rounded-xl"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedSkill(null);
                  setSkillContent('');
                }}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-xl flex items-center gap-2">
                {importType === 'github' && <Github size={20} className="text-primary" />}
                {importType === 'local' && <HardDrive size={20} className="text-primary" />}
                {!importType ? t('importSkill') : importType === 'github' ? t('importFromGitHub') : t('importFromLocal')}
              </h3>
              <button
                className="btn btn-sm btn-circle btn-ghost"
                onClick={closeImportModal}
              >
                <X size={20} />
              </button>
            </div>
            {importType && (
              <p className="text-sm text-base-content/50 mb-6">
                {importType === 'github' ? t('connectRepoTip') : t('importLocalTip')}
              </p>
            )}

            {!importType ? (
              <div className="space-y-3 mt-5">
                <p className="text-sm text-base-content/60 mb-4">
                  {t('selectImportMethod')}
                </p>

                <div
                  className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors p-4 rounded-xl"
                  onClick={() => setImportType('github')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-base-100 flex items-center justify-center shrink-0">
                      <Github size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-base mb-1">{t('importFromGitHub')}</div>
                      <div className="text-sm text-base-content/60">
                        {t('importGithubTip')}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors p-4 rounded-xl"
                  onClick={() => setImportType('local')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-base-100 flex items-center justify-center shrink-0">
                      <HardDrive size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-base mb-1">{t('importFromLocal')}</div>
                      <div className="text-sm text-base-content/60">
                        {t('importLocalTip')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {importType === 'github' ? (
                  <>
                    <div className="form-control">
                      <label className="label pb-1">
                        <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                          {t('repositoryUrl')}
                        </span>
                      </label>
                      <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="https://github.com/username/skill-name"
                            className="input input-bordered flex-1 rounded-xl"
                            value={importUrl}
                            onChange={(e) => {
                                setImportUrl(e.target.value);
                                if (analysisResult) clearAnalysisResult();
                            }}
                            autoFocus
                          />
                          <button 
                              className={`btn btn-primary rounded-xl min-w-[90px] ${isAnalyzing ? 'loading' : ''}`}
                              onClick={handleAnalyze}
                              disabled={!importUrl || isAnalyzing || isImporting}
                          >
                              {isAnalyzing ? t('analyzing') : t('analyze')}
                          </button>
                      </div>
                      {!analysisResult && (
                        <label className="label">
                            <span className="label-text-alt text-base-content/50">
                            {t('repoMustContainSkill')}
                            </span>
                        </label>
                      )}
                    </div>
                    
                    {/* Analysis Results – Stitch Design */}
                    {analysisResult && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
                                  {t('discoveredSkills')}
                                </span>
                                <span className="badge badge-primary badge-sm font-semibold">
                                  {t('nFound', { count: analysisResult.skills.length })}
                                </span>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                {analysisResult.skills.map((skill) => (
                                    <label
                                      key={skill.path}
                                      className="flex items-start gap-3 p-3 bg-base-200/50 hover:bg-base-200 rounded-xl cursor-pointer transition-colors border border-base-300/50 hover:border-base-300"
                                    >
                                        <input 
                                          type="checkbox" 
                                          className="checkbox checkbox-sm checkbox-primary mt-0.5"
                                          checked={selectedSkillPaths.has(skill.path)}
                                          onChange={() => toggleSelectSkill(skill.path)}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-semibold text-sm">{skill.name}</span>
                                              <span className="text-xs text-base-content/40 font-mono bg-base-300/50 px-1.5 py-0.5 rounded">
                                                {skill.path}
                                              </span>
                                            </div>
                                            {skill.description && (
                                                <div className="text-xs mt-1 text-base-content/50 line-clamp-1">{skill.description}</div>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                  </>
                ) : (
                  <div className="form-control">
                    <label className="label pb-1">
                      <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                        {t('localFolderPath')}
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="/Users/user/Downloads/my-skill"
                      className="input input-bordered w-full rounded-xl"
                      value={importPath}
                      onChange={(e) => setImportPath(e.target.value)}
                      autoFocus
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/50">
                        {t('folderMustContainSkill')}
                      </span>
                    </label>
                  </div>
                )}
                
                {analysisError && (
                    <div className="alert alert-error rounded-xl text-sm py-2">
                        <AlertCircle size={16} />
                        <span>{analysisError}</span>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className="btn btn-ghost rounded-xl"
                    onClick={() => {
                        if (analysisResult) {
                             clearAnalysisResult();
                             setImportUrl('');
                        } else {
                            setImportType(null);
                            setImportUrl('');
                            setImportPath('');
                        }
                    }}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    className="btn btn-primary rounded-xl shadow-lg shadow-primary/25"
                    onClick={handleImport}
                    disabled={
                        isImporting || 
                        isAnalyzing || 
                        (importType === 'github' && !importUrl) ||
                        (importType === 'github' && analysisResult && selectedSkillPaths.size === 0) ||
                        (importType === 'local' && !importPath)
                    }
                  >
                    {isImporting ? (
                         <span className="loading loading-spinner loading-xs" />
                    ) : (
                         <Download size={16} />
                    )}
                    {analysisResult
                      ? t('importSelected', { count: selectedSkillPaths.size })
                      : t('import')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MySkills;
