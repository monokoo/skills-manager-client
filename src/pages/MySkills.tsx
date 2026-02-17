import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { 
  Trash2, Eye, FolderOpen, X, Github, HardDrive, Plus, ExternalLink, 
  RefreshCw, AlertCircle, CheckCircle, Package, Calendar, Download, 
  CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown,
  BookOpen, CheckCircle2
} from 'lucide-react';
import { SearchBox } from '../components/ui/SearchBox';
import { StickyHeader } from '../components/ui/StickyHeader';
import type { InstalledSkill } from '../types';
import { invoke } from '@tauri-apps/api/core';
// Using dynamic import for @tauri-apps/plugin-dialog to ensure browser compatibility

interface CommandResult {
  success: boolean;
  message: string;
}

const MySkills = () => {
  const { t } = useTranslation();
  const {
    installedSkills,
    scanLocalSkills,
    updateSelectedSkills,
    checkSkillUpdates,
    reinstallSkill,
    isCheckingUpdates,
    isUpdating,
    analyzeGithubRepo,
    analyzeLocalFolder,
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
  const [toastMessage, setToastMessage] = useState<{show: boolean, success: boolean, message: string}>({show: false, success: false, message: ''});
  const [formError, setFormError] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updateResult, setUpdateResult] = useState<{show: boolean, success: number, failed: number} | null>(null);
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'installDate' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const showToast = (success: boolean, message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ show: true, success, message });
    toastTimerRef.current = setTimeout(() => setToastMessage({ show: false, success: false, message: '' }), 6000);
  };

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
        showToast(true, `${skill.name} ${t('deleteSuccess')}`);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(skill.id);
          return next;
        });
        await scanLocalSkills();
      } else {
        showToast(false, `${t('deleteError')}: ${result.message}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      showToast(false, `${t('deleteError')}: ${errMsg}`);
    } finally {
      setIsDeleting(false);
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

    showToast(failCount === 0, t('batchDeleteComplete', { success: successCount, fail: failCount }));
    setSelectedIds(new Set());
    await scanLocalSkills();
    setIsDeleting(false);
  };

  // 单个更新
  const handleSingleUpdate = async (skillId: string) => {
    setUpdatingSkillId(skillId);
    try {
      await reinstallSkill(skillId);
      showToast(true, t('updateSuccess'));
    } catch {
      showToast(false, t('updateFailed'));
    } finally {
      setUpdatingSkillId(null);
    }
  };

  useEffect(() => {
    scanLocalSkills();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSkills = installedSkills
    .filter(skill => {
      const matchesTab = activeTab === 'all' || skill.type === activeTab;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query ||
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query);
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      if (!sortBy) return 0;
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'installDate') return ((a.installDate || 0) - (b.installDate || 0)) * dir;
      return 0;
    });

  const toggleSort = (field: 'name' | 'installDate') => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: 'name' | 'installDate' }) => {
    if (sortBy !== field) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

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
    if (!importUrl.trim()) {
      setFormError(t('enterGithubUrl'));
      return;
    }
    setFormError(null);
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
    setFormError(null);
    setAnalysisError(null);

    try {
      if (importType === 'local') {
          if (!analysisResult) {
              // First step: analyze local folder
              const result = await analyzeLocalFolder(importPath);
              if (result.success) {
                  if (result.skills.length === 0) {
                    setAnalysisError(t('noSkillFound'));
                  } else {
                    const allPaths = new Set(result.skills.map(s => s.path));
                    setSelectedSkillPaths(allPaths);
                  }
              } else {
                  setAnalysisError(result.message);
              }
              setIsImporting(false);
              return;
          }

          // Second step: perform import
          if (selectedSkillPaths.size === 0) {
              setAnalysisError(t('pleaseSelectSkill'));
              setIsImporting(false);
              return;
          }

          const result = await importSelectedSkills(
              importPath, 
              Array.from(selectedSkillPaths),
              '' 
          );

          if (result.success) {
            showToast(true, result.message || t('importSuccessLocal'));
            setImportType(null);
            setImportPath('');
            setSelectedSkillPaths(new Set());
            clearAnalysisResult();
            setShowImportModal(false);
          } else {
            setAnalysisError(result.message);
          }
      } else if (importType === 'github') {
        if (!analysisResult) {
            await handleAnalyze(); 
            setIsImporting(false);
            return;
        }

        if (selectedSkillPaths.size === 0) {
            setAnalysisError(t('pleaseSelectSkill'));
            setIsImporting(false);
            return;
        }

        const result = await importSelectedSkills(
            analysisResult.tempPath,
            Array.from(selectedSkillPaths),
            importUrl
        );

        if (result.success) {
          showToast(true, result.message || t('importSuccessGitHub'));
          setImportType(null);
          setImportUrl('');
          setSelectedSkillPaths(new Set());
          clearAnalysisResult();
          setShowImportModal(false);
        } else {
          setAnalysisError(result.message);
        }
      }
    } catch (error) {
      console.error('[UI] Import failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setAnalysisError(errMsg);
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportType(null);
    setImportUrl('');
    setImportPath('');
    clearAnalysisResult(); // Clear analysis result on modal close
    setSelectedSkillPaths(new Set()); // Clear selected paths
    setAnalysisError(null); // Clear any analysis errors
    setFormError(null); // Clear any form errors
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
    setTimeout(() => setUpdateResult(null), 6000);
  };

  // 获取可更新的选中 Skills
  const updatableSelected = Array.from(selectedIds).filter(id => {
    const skill = installedSkills.find(s => s.id === id);
    return skill?.sourceUrl;
  });

  return (
    <div>
      {/* Toast Notifications */}
      {toastMessage.show && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert ${toastMessage.success ? 'alert-success' : 'alert-error'} shadow-lg rounded-2xl`}>
            <span>{toastMessage.message}</span>
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

      <StickyHeader className="space-y-4">
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
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 h-12 rounded-2xl border border-gray-200/60 dark:border-white/10
              bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium
              hover:bg-white/80 dark:hover:bg-white/10 hover:border-blue-500/30 transition-all duration-200 shadow-sm"
            onClick={() => checkSkillUpdates()}
            disabled={isCheckingUpdates}
          >
            <motion.div
              animate={isCheckingUpdates ? { rotate: 360 } : { rotate: 0 }}
              transition={isCheckingUpdates ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
            >
              <RefreshCw size={16} className={isCheckingUpdates ? 'text-blue-500' : ''} />
            </motion.div>
            {t('checkUpdates')}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 h-12 rounded-2xl font-semibold text-sm text-white border-none shadow-lg
              bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700
              transition-all duration-300 relative overflow-hidden group whitespace-nowrap"
            onClick={() => setShowImportModal(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer z-0" />
            <Plus size={18} className="relative z-10" />
            <span className="relative z-10">{t('importSkill')}</span>
          </motion.button>
        </div>
      </div>

      {/* Tabs & Search & Batch Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div role="tablist" className="tabs tabs-boxed bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-gray-200/60 dark:border-white/10">
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

          {!selectedIds.size && (
            <SearchBox
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('searchPlaceholder') || "搜索技能名称或描述..."}
              width={200}
              expandedWidth={280}
            />
          )}
        </div>

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-base-content/60">
              {t('selectedCount', { count: selectedIds.size })}
            </span>
            <button
              className="btn btn-sm btn-primary gap-2 rounded-xl h-9"
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
              className="btn btn-sm btn-error btn-outline gap-2 rounded-xl h-9"
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
              className="btn btn-sm btn-ghost rounded-xl h-9"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
      </StickyHeader>

      {/* Skills List Area - Added min-height to prevent layout jump */}
      <div className="min-h-[400px] pt-4">
        {filteredSkills.length > 0 ? (
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10 overflow-hidden shadow-sm">
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
            <button
              className="flex-1 min-w-0 flex items-center gap-1 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              onClick={() => toggleSort('name')}
            >
              {t('name')}
              <SortIcon field="name" />
            </button>
            <div className="w-24 text-center hidden sm:block">{t('sourceHeader')}</div>
            <button
              className="w-40 text-center hidden md:flex items-center justify-center gap-1 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              onClick={() => toggleSort('installDate')}
            >
              {t('installedHeader')}
              <SortIcon field="installDate" />
            </button>
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

                {/* Name, Description & Paths */}
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={skill.description}>
                    {skill.description}
                  </p>
                  {/* Installation Paths */}
                  {skill.localPaths && skill.localPaths.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {skill.localPaths.map((p, i) => (
                        <button
                          key={i}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono
                            bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400
                            rounded border border-gray-200/60 dark:border-white/10
                            hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400
                            transition-colors truncate max-w-[50vw] sm:max-w-none"
                          title={p}
                          onClick={(e) => {
                            e.stopPropagation();
                            invoke('open_url', { url: `file://${p}` }).catch(() => {});
                          }}
                        >
                          <FolderOpen size={9} />
                          {p.replace(/^\/Users\/[^/]+/, '~')}
                        </button>
                      ))}
                    </div>
                  )}
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
                <div className="w-40 hidden md:flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar size={12} />
                  <span className="font-mono">{formatDate(skill.installDate)}</span>
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
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10 p-12 text-center shadow-sm animate-fade-in flex flex-col items-center justify-center min-h-[400px]">
            <div className="mt-[-4px]"> {/* Re-aligning empty state icon to match list item top offset */}
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
          </div>
        )}
      </div>

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
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeImportModal}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl 
                rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 pb-2">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  {importType === 'github' && <Github size={20} className="text-blue-500" />}
                  {importType === 'local' && <HardDrive size={20} className="text-blue-500" />}
                  {!importType ? t('importSkill') : importType === 'github' ? t('importFromGitHub') : t('importFromLocal')}
                </h3>
                <button
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  onClick={closeImportModal}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 pt-0">
                {importType && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                    {importType === 'github' ? t('connectRepoTip') : t('importLocalTip')}
                  </p>
                )}

                {/* Selection View */}
                {!importType ? (
                  <div className="space-y-4 mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">
                      {t('selectImportMethod')}
                    </p>

                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="group flex items-start gap-4 p-4 bg-white/50 dark:bg-white/5 
                        hover:bg-white/80 dark:hover:bg-white/10 cursor-pointer transition-all 
                        rounded-2xl border border-gray-100 dark:border-white/5"
                      onClick={() => {
                        setImportType('github');
                        setFormError(null);
                      }}
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/20 
                        flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0
                        group-hover:scale-110 transition-transform">
                        <Github size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-base mb-0.5">{t('importFromGitHub')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t('importGithubTip')}
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="group flex items-start gap-4 p-4 bg-white/50 dark:bg-white/5 
                        hover:bg-white/80 dark:hover:bg-white/10 cursor-pointer transition-all 
                        rounded-2xl border border-gray-100 dark:border-white/5"
                      onClick={() => {
                        setImportType('local');
                        setFormError(null);
                      }}
                    >
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 
                        flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0
                        group-hover:scale-110 transition-transform">
                        <HardDrive size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-base mb-0.5">{t('importFromLocal')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t('importLocalTip')}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  /* Input View */
                  <div className="space-y-6">
                    {importType === 'github' ? (
                      <div className="space-y-5">
                        <div className="form-control">
                          <label className="label pt-0 pb-2">
                            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-base-content/40">
                              {t('repositoryUrl')}
                            </span>
                          </label>
                            <input
                              type="text"
                              placeholder="https://github.com/username/skill-name"
                              className={`input w-full h-12 pl-4 pr-4 bg-black/5 dark:bg-white/5 
                                border-gray-200/60 dark:border-white/10 rounded-2xl 
                                focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 
                                transition-all duration-300 font-mono text-xs shadow-inner
                                placeholder:text-base-content/20
                                ${formError && importType === 'github' ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500/50' : ''}`}
                              value={importUrl}
                              onChange={(e) => {
                                setImportUrl(e.target.value);
                                if (analysisResult) clearAnalysisResult();
                                if (formError) setFormError(null);
                                if (analysisError) setAnalysisError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && importUrl.trim()) {
                                  handleAnalyze();
                                }
                              }}
                              autoFocus
                            />


                          <div className="mt-2 h-6 flex items-center px-1 overflow-hidden">
                            <AnimatePresence mode="wait">
                              {formError && importType === 'github' ? (
                                <motion.div
                                  key="error"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="flex items-center gap-1.5 text-red-500 text-[11px] font-medium"
                                >
                                  <AlertCircle size={12} className="shrink-0" />
                                  <span>{formError}</span>
                                </motion.div>
                              ) : (
                                !analysisResult && (
                                  <motion.div 
                                    key="tip"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex items-center gap-1.5 text-base-content/30 dark:text-gray-500 text-[11px] italic"
                                  >
                                    <AlertCircle size={12} className="shrink-0 opacity-50" />
                                    <span>{t('repoMustContainSkill')}</span>
                                  </motion.div>
                                )
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Analysis Results */}
                        <AnimatePresence>
                          {analysisResult && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="space-y-3 overflow-hidden"
                            >
                              <div className="flex justify-between items-center px-1">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      toggleSelectAllSkills();
                                    }}
                                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                                    title={selectedSkillPaths.size === analysisResult.skills.length ? t('deselectAll') : t('selectAll')}
                                  >
                                    {selectedSkillPaths.size === analysisResult.skills.length ? (
                                      <CheckSquare size={16} className="text-blue-500" />
                                    ) : (
                                      <Square size={16} className="text-gray-400" />
                                    )}
                                  </button>
                                  <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                                    {t('discoveredSkills')}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-bold">
                                  {t('nFound', { count: analysisResult.skills.length })}
                                </span>
                              </div>
                              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar p-1">
                                {analysisResult.skills.length === 0 ? (
                                  <div className="text-center py-8 text-gray-400 text-sm">
                                    未在仓库中发现 Skill
                                  </div>
                                ) : analysisResult.skills.map((skill, index) => (
                                  <motion.div
                                    key={skill.path}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`relative flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border group overflow-hidden
                                      ${selectedSkillPaths.has(skill.path)
                                        ? 'bg-blue-50/80 dark:bg-blue-500/10 border-blue-200/50 dark:border-blue-500/20 shadow-sm ring-1 ring-blue-500/10'
                                        : 'bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-sm'}`}
                                    onClick={() => toggleSelectSkill(skill.path)}
                                  >
                                    {/* Selection Indicator Bar */}
                                    {selectedSkillPaths.has(skill.path) && (
                                      <motion.div 
                                        layoutId="selection-bar"
                                        className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"
                                      />
                                    )}

                                    {/* Icon */}
                                    <div className={`mt-1 shrink-0 p-2 rounded-xl transition-colors
                                      ${selectedSkillPaths.has(skill.path) 
                                        ? 'bg-blue-500 text-white shadow-blue-500/20 shadow-lg' 
                                        : 'bg-black/5 dark:bg-white/10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                                      <BookOpen size={18} strokeWidth={2.5} />
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={`font-bold text-sm tracking-tight ${selectedSkillPaths.has(skill.path) ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                          {skill.name}
                                        </span>
                                        {selectedSkillPaths.has(skill.path) && (
                                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                            <CheckCircle2 size={16} className="text-blue-500" />
                                          </motion.div>
                                        )}
                                      </div>
                                      
                                      {skill.description && skill.description.trim() !== '' && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                          {skill.description}
                                        </div>
                                      )}

                                      <div className="pt-1">
                                        <span className="text-[10px] text-gray-400 font-mono bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md truncate max-w-full inline-block">
                                          {skill.path}
                                        </span>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="form-control">
                          <label className="label pt-0 pb-2">
                            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-base-content/40">
                              {t('localFolderPath')}
                            </span>
                          </label>
                          
                          <div className="relative group">
                            <input
                              type="text"
                              placeholder="/Users/user/Downloads/my-skill"
                              className={`input w-full h-12 pl-4 pr-12 bg-black/5 dark:bg-white/5 
                                border-gray-200/60 dark:border-white/10 rounded-2xl 
                                focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 
                                transition-all duration-300 font-mono text-xs shadow-inner
                                placeholder:text-base-content/20
                                ${formError && importType === 'local' ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500/50' : ''}`}
                               value={importPath}
                               onChange={(e) => {
                                 setImportPath(e.target.value);
                                 if (analysisResult) clearAnalysisResult();
                                 if (formError) setFormError(null);
                                 if (analysisError) setAnalysisError(null);
                               }}
                               autoFocus
                             />
                             <div className="absolute right-3 inset-y-0 flex items-center">
                               <button 
                                 className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-base-content/40 hover:text-blue-500"
                                 onClick={async (e) => {
                                   e.preventDefault();
                                   try {
                                     // Check if we are in Tauri environment
                                     if ((window as any).__TAURI_INTERNALS__) {
                                       const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
                                       const selected = await openDialog({
                                         directory: true,
                                         multiple: false,
                                       });
                                       if (selected && typeof selected === 'string') {
                                         setImportPath(selected);
                                         if (analysisResult) clearAnalysisResult();
                                         if (formError) setFormError(null);
                                         if (analysisError) setAnalysisError(null);
                                       }
                                     } else {
                                       console.warn('Native dialog is only available in Tauri app.');
                                       setFormError(t('nativeDialogOnly'));
                                     }
                                   } catch (err) {
                                     console.error('Failed to open directory dialog:', err);
                                   }
                                 }}
                               >
                                 <FolderOpen size={16} />
                               </button>
                             </div>
                           </div>

                          <div className="mt-2 h-6 flex items-center px-1 overflow-hidden">
                            <AnimatePresence mode="wait">
                              {formError && importType === 'local' ? (
                                <motion.div
                                  key="error"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="flex items-center gap-1.5 text-red-500 text-[11px] font-medium"
                                >
                                  <AlertCircle size={12} className="shrink-0" />
                                  <span>{formError}</span>
                                </motion.div>
                              ) : (
                                <motion.div 
                                  key="tip"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="flex items-center gap-1.5 text-base-content/30 dark:text-gray-500 text-[11px] italic"
                                >
                                  <AlertCircle size={12} className="shrink-0 opacity-50" />
                                  <span>{t('folderMustContainSkill')}</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}

                    {analysisError && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3 text-sm"
                      >
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{analysisError}</span>
                      </motion.div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-6 h-10 rounded-xl font-medium text-sm border-none shadow-lg
                          bg-gradient-to-r from-blue-600 to-indigo-600 text-white
                          shadow-blue-500/25 hover:shadow-blue-500/40
                          transition-all duration-300 min-w-[100px]"
                         onClick={() => {
                           if (!analysisResult && !isImporting) {
                             if (importType === 'local') {
                               if (!importPath.trim()) {
                                 setFormError(t('enterLocalPath'));
                                 return;
                               }
                               setFormError(null);
                             }
                             if (importType === 'github') {
                               handleAnalyze();
                             } else {
                               handleImport();
                             }
                           } else {
                             handleImport();
                           }
                         }}
                         disabled={
                           (importType === 'local' && !!isAnalyzing) || // Local analyze handled by separate button for now (TODO: unify?)
                           (importType === 'github' && isAnalyzing) ||
                           !!isImporting ||
                           (!!analysisResult && (analysisResult.skills.length === 0 || selectedSkillPaths.size === 0))
                         }
                       >
                        {isImporting || isAnalyzing ? <span className="loading loading-spinner loading-xs mr-2" /> : null}
                        {isImporting
                          ? t('importing')
                          : isAnalyzing
                            ? t('analyzing')
                            : analysisResult
                              ? t('import')
                              : t('analyze')}
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MySkills;
