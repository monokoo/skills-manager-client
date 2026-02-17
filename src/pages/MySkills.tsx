import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { 
  Trash2, Eye, FolderOpen, X, Github, HardDrive, Plus, ExternalLink, 
  RefreshCw, AlertCircle, CheckCircle, Package, Calendar, Download, 
  CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown,
  BookOpen, CheckCircle2, AlertTriangle, Shield
} from 'lucide-react';
import { SearchBox } from '../components/ui/SearchBox';
import { StickyHeader } from '../components/ui/StickyHeader';
import { InstallLevelPicker, type InstallLevel } from '../components/ui/InstallLevelPicker';
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
    importSelectedSkills,
    defaultInstallLocation,
    projectPaths,
    selectedProjectIndex,
    setSelectedProjectIndex
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
  const [importLevel, setImportLevel] = useState<InstallLevel>(defaultInstallLocation as InstallLevel || 'system');
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<Set<string>>(new Set());
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Delete paths modal state
  const [deleteTarget, setDeleteTarget] = useState<InstalledSkill | null>(null);
  const [selectedDeletePaths, setSelectedDeletePaths] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<{show: boolean, success: boolean, message: string}>({show: false, success: false, message: ''});
  const [formError, setFormError] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Backend error message → i18n key mapping
  const backendErrorMap: Record<string, string> = {
    'Invalid GitHub URL': 'error.invalidGithubUrl',
    'Invalid URL': 'error.invalidUrl',
    'Cannot determine skills directory': 'error.cannotDetermineSkillsDir',
    'No skill paths provided': 'error.noSkillPathsProvided',
    'Source path does not exist': 'error.sourcePathNotExist',
    'Source directory not found': 'error.sourceDirNotFound',
    'Temporary import directory not found': 'error.tempDirNotFound',
  };

  const translateBackendError = (msg: string): string => {
    // Exact match
    if (backendErrorMap[msg]) return t(backendErrorMap[msg]);
    // Partial match for dynamic messages like "Git clone failed: ..."
    if (msg.startsWith('Git clone failed')) return `${t('error.gitCloneFailed')}: ${msg.slice('Git clone failed:'.length).trim()}`;
    if (msg.startsWith('Git command failed')) return `${t('error.gitCommandFailed')}: ${msg.slice('Git command failed:'.length).trim()}`;
    return msg;
  };

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

    const paths = skill.localPaths || [skill.localPath];
    // Unified: always show custom confirm modal
    setDeleteTarget(skill);
    setSelectedDeletePaths(new Set(paths));
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || selectedDeletePaths.size === 0) return;

    setIsDeleting(true);
    try {
      const result = await invoke<CommandResult>('uninstall_skill', {
        request: { skillPaths: Array.from(selectedDeletePaths) }
      });

      if (result.success) {
        showToast(true, `${deleteTarget.name} ${t('deleteSuccess')}`);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
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
      setDeleteTarget(null);
      setSelectedDeletePaths(new Set());
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
        setAnalysisError(translateBackendError(result.message));
      }
    } catch (err) {
      setAnalysisError(translateBackendError(err instanceof Error ? err.message : String(err)));
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
                  setAnalysisError(translateBackendError(result.message));
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

          // Check for existing skills
          const existingSkills = analysisResult.skills.filter(
            s => selectedSkillPaths.has(s.path) && s.exists
          );
          if (existingSkills.length > 0) {
            const names = existingSkills.map(s => `  • ${s.name}`).join('\n');
            if (!window.confirm(t('importOverwriteConfirm', { names }))) {
              setIsImporting(false);
              return;
            }
          }

          const importInstallPath = importLevel === 'project' && projectPaths.length > 0
            ? (projectPaths[selectedProjectIndex] || projectPaths[0])
            : undefined;

          const result = await importSelectedSkills(
              importPath, 
              Array.from(selectedSkillPaths),
              '',
              importInstallPath
          );

          if (result.success) {
            showToast(true, result.message || t('importSuccessLocal'));
            setImportType(null);
            setImportPath('');
            setSelectedSkillPaths(new Set());
            clearAnalysisResult();
            setShowImportModal(false);
          } else {
            setAnalysisError(translateBackendError(result.message));
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

        // Check for existing skills
        const existingSkills = analysisResult.skills.filter(
          s => selectedSkillPaths.has(s.path) && s.exists
        );
        if (existingSkills.length > 0) {
          const names = existingSkills.map(s => `  • ${s.name}`).join('\n');
          if (!window.confirm(t('importOverwriteConfirm', { names }))) {
            setIsImporting(false);
            return;
          }
        }

        const importInstallPath = importLevel === 'project' && projectPaths.length > 0
          ? (projectPaths[selectedProjectIndex] || projectPaths[0])
          : undefined;

        const result = await importSelectedSkills(
            analysisResult.tempPath,
            Array.from(selectedSkillPaths),
            importUrl,
            importInstallPath
        );

        if (result.success) {
          showToast(true, result.message || t('importSuccessGitHub'));
          setImportType(null);
          setImportUrl('');
          setSelectedSkillPaths(new Set());
          clearAnalysisResult();
          setShowImportModal(false);
        } else {
          setAnalysisError(translateBackendError(result.message));
        }
      }
    } catch (error) {
      console.error('[UI] Import failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setAnalysisError(translateBackendError(errMsg));
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

      {/* Tabs & Search / Batch Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Tabs */}
        <div role="tablist" className="tabs tabs-boxed bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-gray-200/60 dark:border-white/10 shrink-0">
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

        {/* Right: Search OR Batch Actions (mutually exclusive, same position) */}
        <AnimatePresence mode="wait">
          {selectedIds.size > 0 ? (
            <motion.div
              key="batch-bar"
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex items-center ml-auto bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-lg px-2 py-1.5 gap-1.5 sm:gap-2 md:px-3 md:gap-3"
            >
              {/* Count Badge */}
              <div className="flex items-center gap-1.5 pl-1">
                <div className="flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded-lg text-xs sm:text-sm min-w-[20px] sm:min-w-[24px] sm:px-2">
                  {selectedIds.size}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden md:inline whitespace-nowrap">
                  {t('selected')}
                </span>
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-gray-200 dark:bg-white/10 mx-1 hidden sm:block" />

              {/* Select All / Deselect All */}
              <button
                title={selectedIds.size === filteredSkills.length ? t('deselectAll') : t('selectAllSkills')}
                className="p-1.5 md:px-2 md:py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                onClick={() => {
                  if (selectedIds.size === filteredSkills.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filteredSkills.map(s => s.id)));
                  }
                }}
              >
                {selectedIds.size === filteredSkills.length ? t('deselectAll') : t('selectAllSkills')}
              </button>

              {/* Divider */}
              <div className="h-5 w-px bg-gray-200 dark:bg-white/10 mx-1" />

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all font-medium text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleBatchUpdate}
                  disabled={isUpdating || updatableSelected.length === 0}
                >
                  {isUpdating ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Download size={14} className="md:w-4 md:h-4" />
                  )}
                  <span className="hidden md:inline">{t('batchUpdate')}</span>
                  {updatableSelected.length > 0 && <span className="opacity-80 text-[10px] md:text-xs">({updatableSelected.length})</span>}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-500/30 text-red-500 bg-red-50/50 dark:bg-red-500/10 hover:bg-red-100/50 dark:hover:bg-red-500/20 rounded-xl transition-all font-medium text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Trash2 size={14} className="md:w-4 md:h-4" />
                  )}
                  <span className="hidden md:inline">{t('batchDelete')}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors ml-1"
                  onClick={() => setSelectedIds(new Set())}
                  aria-label={t('cancel')}
                >
                  <X size={16} />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="search-box"
              className="ml-auto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <SearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('searchPlaceholder') || "搜索技能名称或描述..."}
                width={200}
                expandedWidth={280}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
                  {skill.description && skill.description.trim() !== '' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={skill.description}>
                      {skill.description}
                    </p>
                  )}
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
                                        {skill.exists && (
                                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20">
                                            {t('alreadyInstalled')}
                                          </span>
                                        )}
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

                    {/* Install Level Picker */}
                    {analysisResult && analysisResult.skills.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {t('installLevelTitle')}
                        </p>
                        <InstallLevelPicker
                          value={importLevel}
                          onChange={setImportLevel}
                          projectPaths={projectPaths}
                          selectedProjectIndex={selectedProjectIndex}
                          onProjectIndexChange={setSelectedProjectIndex}
                        />
                      </div>
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
                          setAnalysisError(null);
                          setFormError(null);
                          setSelectedSkillPaths(new Set());
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

      {/* Delete Paths Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
              onClick={() => { setDeleteTarget(null); setSelectedDeletePaths(new Set()); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10">
                    <AlertTriangle size={20} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {t('deleteTitle')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {deleteTarget.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setDeleteTarget(null); setSelectedDeletePaths(new Set()); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Path Selection */}
              <div className="px-6 py-3">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {t('selectPathsToDelete')}
                </p>
                <div className="space-y-2">
                  {(deleteTarget.localPaths || [deleteTarget.localPath]).map((p, i) => {
                    const isChecked = selectedDeletePaths.has(p);
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
                          ${isChecked
                            ? 'bg-red-50/60 dark:bg-red-500/5 border-red-300 dark:border-red-500/30 shadow-sm shadow-red-500/5'
                            : 'bg-gray-50/50 dark:bg-white/5 border-gray-200/50 dark:border-white/10 hover:bg-gray-100/60 dark:hover:bg-white/8 hover:border-gray-300 dark:hover:border-white/20'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedDeletePaths(prev => {
                              const next = new Set(prev);
                              if (next.has(p)) next.delete(p);
                              else next.add(p);
                              return next;
                            });
                          }}
                          className="sr-only"
                        />
                        <div className={`
                          w-[18px] h-[18px] rounded-md border-2 shrink-0
                          flex items-center justify-center transition-all duration-200
                          ${isChecked
                            ? 'bg-red-500 border-red-500 shadow-sm shadow-red-500/30'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-white/10'
                          }
                        `}>
                          <svg
                            className={`w-3 h-3 text-white transition-all duration-200 ${isChecked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 6L5 8.5L9.5 3.5" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-mono break-all leading-relaxed transition-colors duration-200
                            ${isChecked ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                            {p.replace(/^\/Users\/[^/]+/, '~')}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Danger Warning */}
              <div className="mx-6 mb-4 p-3 rounded-xl bg-red-50/80 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/15">
                <div className="flex items-start gap-2">
                  <Shield size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                      {t('dangerZone')}
                    </span>
                    <p className="text-xs text-red-500/80 dark:text-red-400/70 mt-0.5 leading-relaxed">
                      {t('deleteWarning')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 px-6 pb-5">
                <button
                  onClick={() => { setDeleteTarget(null); setSelectedDeletePaths(new Set()); }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={selectedDeletePaths.size === 0 || isDeleting}
                  className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
                >
                  {isDeleting && <span className="loading loading-spinner loading-xs" />}
                  <Trash2 size={14} />
                  {t('confirmDelete', { count: selectedDeletePaths.size })}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MySkills;
