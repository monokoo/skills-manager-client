import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { Download, Star, ExternalLink, Check, Loader2, Shield, ShieldCheck, ShieldAlert, X, CheckSquare, Square, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles, Package, RefreshCw, GitFork, Globe } from 'lucide-react';
import { SearchBox } from '../components/ui/SearchBox';
import { StickyHeader } from '../components/ui/StickyHeader';
import { InstallLevelPicker, type InstallLevel } from '../components/ui/InstallLevelPicker';
import { getLocalizedDescription } from '../utils/i18n';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSourcesTab from '../components/marketplace/CustomSourcesTab';

import SkillDetailDrawer from '../components/marketplace/SkillDetailDrawer';
import { useSkillsShSearch } from '../hooks/useSkillsShSearch';
import type { MarketplaceSkill, CustomMarketplaceSkill } from '../types';

interface SecurityReport {
  skillId: string;
  score: number;
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  issues: any[];
  blocked: boolean;
  recommendations: string[];
  scannedFiles: string[];
}

type InstallPhase = 'idle' | 'downloading' | 'installing' | 'scanning' | 'done';

interface InstallStatus {
  show: boolean;
  phase: InstallPhase;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  securityReport?: SecurityReport;
}

const TAB_ACTIVE_STYLE = 'bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-400 shadow-sm';
const TAB_INACTIVE_STYLE = 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300';
const DEFAULT_SYSTEM_SKILLS_PATH = '~/.claude/skills';

const BatchActionBar = ({ 
  selectedCount, 
  onInstall, 
  onSelectAll, 
  onClear, 
  isInstalling 
}: { 
  selectedCount: number; 
  onInstall: () => void; 
  onSelectAll: () => void; 
  onClear: () => void; 
  isInstalling: boolean 
}) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="fixed bottom-32 left-4 right-4 z-50 mx-auto max-w-lg"
    >
      <div className="bg-white/60 dark:bg-black/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl p-1.5 md:p-2 shadow-2xl flex items-center justify-between gap-1.5 md:gap-3">
        <div className="flex items-center gap-1.5 md:gap-3 pl-1 md:pl-2">
          <span className="text-xs font-black text-blue-500 whitespace-nowrap">
            {selectedCount} {t('selected')}
          </span>
          <div className="h-5 w-px bg-gray-200 dark:bg-white/10" />
          <div className="flex gap-1">
            <button
              onClick={onSelectAll}
              className="px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {t('selectAll')}
            </button>
            <button
              onClick={onClear}
              className="px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors whitespace-nowrap"
            >
              {t('clear')}
            </button>
          </div>
        </div>

        <button
          className="h-8 md:h-9 px-3 md:px-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50"
          onClick={onInstall}
          disabled={selectedCount === 0 || isInstalling}
        >
          {isInstalling ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Download size={14} />
          )}
          <span>{t('install')}</span>
        </button>
      </div>
    </motion.div>
  );
};

const Marketplace = () => {
  const { t, i18n } = useTranslation();
  const {
    marketplaceSkills,
    fetchMarketplaceSkills,
    installSkill,
    installedSkills,
    isLoading,
    defaultInstallLocation,
    projectPaths,
    selectedProjectIndex,
    customSources,
    customMarketplaceSkills,
    fetchCustomMarketplace,
    officialSourceEnabled,
    showSourceBadge,
  } = useSkillStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const [isBatchInstalling, setIsBatchInstalling] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedSkills, setBatchSelectedSkills] = useState<string[]>([]);
  // Install confirm modal state
  const getDefaultProjectIndices = () =>
    selectedProjectIndex >= 0 && selectedProjectIndex < projectPaths.length
      ? [selectedProjectIndex]
      : [];
  const [installTarget, setInstallTarget] = useState<any>(null);
  const [installLevel, setInstallLevel] = useState<InstallLevel>(defaultInstallLocation as InstallLevel || 'system');
  // Batch install confirm
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [selectedProjectIndices, setSelectedProjectIndices] = useState<number[]>(getDefaultProjectIndices());
  const [installStatus, setInstallStatus] = useState<InstallStatus>({
    show: false,
    phase: 'idle',
    message: '',
    type: 'info'
  });
  const pageSize = 12;
  const [activeTab, setActiveTab] = useState<'official' | 'skillssh' | 'custom'>('official');
  // skills.sh search: enabled when user is searching globally (min 2 chars) OR browsing skillssh tab
  const { results: skillsShResults, isSearching: isSearchingSkillsSh } = useSkillsShSearch(
    searchTerm,
    searchTerm.trim().length >= 2 || activeTab === 'skillssh'
  );
  // Drawer state
  const [selectedSkill, setSelectedSkill] = useState<MarketplaceSkill | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const promises: Promise<void>[] = [];
      if (marketplaceSkills.length === 0) promises.push(fetchMarketplaceSkills());
      promises.push(fetchCustomMarketplace());
      await Promise.allSettled(promises);
    };
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBatchSelect = (skillId: string) => {
    setBatchSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  const clearBatchSelect = () => {
    setBatchSelectedSkills([]);
  };

  const selectAllBatch = (skillIds: string[]) => {
    setBatchSelectedSkills(skillIds);
  };

  const getPhaseMessage = (phase: InstallPhase, skillName: string): string => {
    const messages = {
      downloading: t('downloadingSkill', { name: skillName }),
      installing: t('installingSkill', { name: skillName }),
      scanning: t('scanningSkill'),
      done: t('installSuccess', { name: skillName }),
      idle: ''
    };
    return messages[phase];
  };

  const openInstallConfirm = (skill: any) => {
    if (installingSkillId) return;
    setInstallTarget(skill);
    setInstallLevel(defaultInstallLocation as InstallLevel || 'system');
    setSelectedProjectIndices(getDefaultProjectIndices());
  };

  const handleInstall = async (skill: any, overridePath?: string) => {
    if (installingSkillId) return;

    setInstallTarget(null);
    setInstallingSkillId(skill.id);

    setInstallStatus({
      show: true,
      phase: 'downloading',
      message: getPhaseMessage('downloading', skill.name),
      type: 'info'
    });

    try {
      setTimeout(() => {
        setInstallStatus(prev => ({
          ...prev,
          phase: 'installing',
          message: getPhaseMessage('installing', skill.name)
        }));
      }, 500);

      const result = await installSkill(skill, overridePath);

      setInstallStatus(prev => ({
        ...prev,
        phase: 'scanning',
        message: getPhaseMessage('scanning', skill.name)
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      if (result.securityReport) {
        const report = result.securityReport;
        const isRisky = report.level === 'high' || report.level === 'critical' || report.blocked;

        setInstallStatus({
          show: true,
          phase: 'done',
          message: isRisky
            ? t('installSuccessRisky', { name: skill.name })
            : t('installSuccessScore', { name: skill.name, score: report.score }),
          type: isRisky ? 'warning' : 'success',
          securityReport: report
        });
      } else {
        setInstallStatus({
          show: true,
          phase: 'done',
          message: getPhaseMessage('done', skill.name),
          type: 'success'
        });
      }

      if (!result.securityReport?.blocked && result.securityReport?.level !== 'critical') {
        setTimeout(() => {
          setInstallStatus(prev => {
            if (prev.phase === 'done' && !prev.securityReport?.blocked) {
              return { show: false, phase: 'idle', message: '', type: 'info' };
            }
            return prev;
          });
        }, 5000);
      }

    } catch (error: any) {
      console.error('Installation error:', error);
      const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown error');
      setInstallStatus({
        show: true,
        phase: 'done',
        message: t('installError', { error: errorMessage }),
        type: 'error'
      });
      setTimeout(() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' }), 5000);
    } finally {
      setInstallingSkillId(null);
    }
  };

  const handleBatchInstall = async (overridePaths: (string | undefined)[]) => {
    if (batchSelectedSkills.length === 0 || isBatchInstalling) return;

    const skillsToInstall = marketplaceSkills.filter(s => batchSelectedSkills.includes(s.id));
    if (skillsToInstall.length === 0) return;

    // Overwrite check: confirm before overwriting already-installed skills
    const existingSkills = skillsToInstall.filter(s => isInstalled(s.id, s.name, s.githubUrl));
    if (existingSkills.length > 0) {
      const names = existingSkills.map(s => `  • ${s.name}`).join('\n');
      let confirmed = false;
      try {
        if ((window as any).__TAURI_INTERNALS__) {
          const { confirm: tauriConfirm } = await import('@tauri-apps/plugin-dialog');
          confirmed = await tauriConfirm(
            t('importOverwriteConfirm', { names }),
            {
              title: t('overwriteConfirmTitle'),
              okLabel: t('overwriteConfirm'),
              cancelLabel: t('cancel'),
            }
          );
        } else {
          confirmed = window.confirm(t('importOverwriteConfirm', { names }));
        }
      } catch {
        confirmed = window.confirm(t('importOverwriteConfirm', { names }));
      }
      if (!confirmed) return;
    }

    setShowBatchConfirm(false);

    setIsBatchInstalling(true);
    const totalOps = skillsToInstall.length * overridePaths.length;
    setInstallStatus({
      show: true,
      phase: 'installing',
      message: t('installingCount', { count: totalOps }),
      type: 'info'
    });

    let successCount = 0;
    let failCount = 0;

    try {
      for (const overridePath of overridePaths) {
        for (const skill of skillsToInstall) {
          try {
            await installSkill(skill, overridePath);
            successCount++;
          } catch (e) {
            failCount++;
            console.error(`Failed to install ${skill.name}:`, e);
          }
        }
      }

      setInstallStatus({
        show: true,
        phase: 'done',
        message: t('batchInstallComplete', { 
          success: successCount, 
          failText: failCount > 0 ? `, ${failCount} ${t('failed')}` : '' 
        }),
        type: failCount > 0 ? 'warning' : 'success'
      });

      setBatchMode(false);
      clearBatchSelect();
      setTimeout(() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' }), 5000);
    } catch (error: any) {
      console.error('Batch installation error:', error);
      setInstallStatus({
        show: true,
        phase: 'done',
        message: t('batchInstallFailed', { error: error.message }),
        type: 'error'
      });
      setTimeout(() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' }), 5000);
    } finally {
      setIsBatchInstalling(false);
    }
  };

  const handleOpenSource = async (url: string) => {
    // Always open repo root (strip /tree/branch/path if present)
    let repoRoot = url;
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        repoRoot = `${u.origin}/${parts[0]}/${parts[1]}`;
      }
    } catch { /* use original url */ }
    try {
        await invoke('open_url', { url: repoRoot });
    } catch (error) {
        console.error('Failed to open URL:', error);
        alert(t('openUrlError', { error }));
    }
  };

  const isInstalled = (skillId: string, skillName?: string, githubUrl?: string) => {
    return installedSkills.some(s => {
      if (s.id === skillId || s.name === skillId) return true;
      if (githubUrl && s.sourceUrl) return s.sourceUrl === githubUrl;
      // Fallback: name match only when neither side has sourceUrl (local/manual installs)
      if (skillName && !githubUrl && !s.sourceUrl) return s.name === skillName;
      return false;
    });
  };

  const mapCustomToMarketplace = (skill: CustomMarketplaceSkill): MarketplaceSkill => ({
    id: `custom-${skill.sourceId}-${skill.name}`,
    name: skill.name,
    author: skill.author,
    authorAvatar: skill.authorAvatar,
    description: skill.description,
    githubUrl: skill.githubUrl,
    stars: skill.stars ?? 0,
    forks: skill.forks ?? 0,
    updatedAt: skill.updatedAt,
    hasMarketplace: false,
    path: skill.path,
    branch: skill.branch,
    sourceType: 'custom',
    installs: skill.installs,
  });

  const getAggregatedSkills = (): MarketplaceSkill[] => {
    const official = officialSourceEnabled ? marketplaceSkills : [];
    const custom = customMarketplaceSkills.map(mapCustomToMarketplace);

    // Global search: when searchTerm has >= 2 chars, merge all sources with dedup
    if (searchTerm.trim().length >= 2) {
      const localResults = [...official, ...custom];
      const seenKeys = new Set(localResults.map(s => s.githubUrl || `${s.author}/${s.name}`));
      const uniqueRemote = skillsShResults.filter(s => !seenKeys.has(s.githubUrl || `${s.author}/${s.name}`));
      return [...localResults, ...uniqueRemote];
    }

    // Browse mode: return data based on active tab
    switch (activeTab) {
      case 'skillssh':
        return skillsShResults;
      case 'official':
      default:
        return [...official, ...custom];
    }
  };

  const aggregatedSkills = getAggregatedSkills();
  const isGlobalSearch = searchTerm.trim().length >= 2;

  const filteredSkills = aggregatedSkills.filter(skill => {
    // skills.sh results are already API-filtered, skip frontend filter in global search
    if (isGlobalSearch && skill.sourceType === 'skillssh') return true;
    return skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.author.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => (b.stars || b.installs || 0) - (a.stars || a.installs || 0));

  const totalPages = Math.ceil(filteredSkills.length / pageSize);
  const currentSkills = filteredSkills.slice((page - 1) * pageSize, page * pageSize);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);

      if (end - start < maxVisiblePages - 1) {
        if (start === 1) {
          end = Math.min(totalPages, start + maxVisiblePages - 1);
        } else {
          start = Math.max(1, end - maxVisiblePages + 1);
        }
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const getSecurityIcon = (level: string) => {
    switch (level) {
      case 'safe':
      case 'low':
        return <ShieldCheck className="text-success" size={20} />;
      case 'medium':
        return <Shield className="text-warning" size={20} />;
      case 'high':
      case 'critical':
        return <ShieldAlert className="text-error" size={20} />;
      default:
        return <Shield className="text-info" size={20} />;
    }
  };


  return (
    <div>
      {/* Install Status Toast */}
      {installStatus.show && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert shadow-2xl max-w-md rounded-2xl border ${
            installStatus.type === 'success' ? 'alert-success border-success/30' :
            installStatus.type === 'warning' ? 'alert-warning border-warning/30' :
            installStatus.type === 'error' ? 'alert-error border-error/30' : 'alert-info border-info/30'
          }`}>
            <div className="flex items-start gap-3 w-full">
              {installStatus.phase !== 'done' ? (
                <Loader2 className="animate-spin flex-shrink-0 mt-0.5" size={18} />
              ) : installStatus.securityReport ? (
                getSecurityIcon(installStatus.securityReport.level)
              ) : installStatus.type === 'success' ? (
                <Check size={18} className="flex-shrink-0 mt-0.5" />
              ) : null}

              <div className="flex-1 min-w-0">
                <p className="font-semibold">{installStatus.message}</p>

                {installStatus.securityReport && installStatus.phase === 'done' && (
                  <div className="mt-2 text-sm">
                    {installStatus.securityReport.issues.length > 0 && (
                      <p className="opacity-80">
                        {t('foundIssuesCount', { count: installStatus.securityReport.issues.length })}
                      </p>
                    )}
                    {installStatus.securityReport.blocked && (
                      <p className="text-error font-medium mt-1">
                        {t('criticalRiskDetected')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {installStatus.phase === 'done' && (
                <button
                  onClick={() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' })}
                  className="btn btn-ghost btn-xs btn-circle flex-shrink-0 hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <StickyHeader>
      {/* Header Section */}
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl shrink-0">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t('marketplace')}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs sm:text-sm text-primary font-medium">
                {t('marketplaceSkillsCount', { count: aggregatedSkills.length })}
              </span>
              <span className="text-xs sm:text-sm text-success font-medium">
                {t('installedCount', { count: installedSkills.length })}
              </span>
              <span className="text-xs sm:text-sm text-orange-500 font-medium">
                Claude Code
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Batch Mode Toggle */}
          <button
            className={`flex items-center gap-2 px-4 h-10 rounded-xl border transition-all duration-300 font-medium text-sm ${
              batchMode
                ? 'bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-500/25'
                : 'bg-black/5 dark:bg-white/5 border-gray-200/60 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            onClick={() => {
              setBatchMode(!batchMode);
              if (batchMode) clearBatchSelect();
            }}
          >
            <div className={`p-1 rounded-md transition-colors ${batchMode ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'}`}>
              {batchMode ? <CheckSquare size={14} className="text-white" /> : <Square size={14} />}
            </div>
            {t('batchMode')}
          </button>

          {/* Search */}
          <SearchBox
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setPage(1);
            }}
            placeholder={t('searchSkills')}
            width={200}
            expandedWidth={260}
          />
        </div>
      </div>
      </StickyHeader>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-white/5 rounded-xl w-fit mb-6">
        <button
          onClick={() => { setActiveTab('official'); if (batchMode) { setBatchMode(false); clearBatchSelect(); } }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'official'
              ? TAB_ACTIVE_STYLE
              : TAB_INACTIVE_STYLE
          }`}
        >
          <Sparkles size={14} />
          {t('officialMarketplace')}
        </button>
        <button
          onClick={() => { setActiveTab('skillssh'); setPage(1); if (batchMode) { setBatchMode(false); clearBatchSelect(); } }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'skillssh'
              ? TAB_ACTIVE_STYLE
              : TAB_INACTIVE_STYLE
          }`}
        >
          <Globe size={14} />
          {t('skillsShTab')}
        </button>
        <button
          onClick={() => { setActiveTab('custom'); if (batchMode) { setBatchMode(false); clearBatchSelect(); } }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'custom'
              ? TAB_ACTIVE_STYLE
              : TAB_INACTIVE_STYLE
          }`}
        >
          <GitFork size={14} />
          {t('customSources')}
          {customSources.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-semibold">
              {customSources.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'custom' ? (
        <CustomSourcesTab />
      ) : (
        <>


      {/* Batch Action Bar */}
      <AnimatePresence>
        {batchMode && (
          <BatchActionBar
            selectedCount={batchSelectedSkills.length}
            onInstall={() => {
              setInstallLevel(defaultInstallLocation as InstallLevel || 'system');
              setSelectedProjectIndices(getDefaultProjectIndices());
              setShowBatchConfirm(true);
            }}
            onSelectAll={() => {
              const uninstalledIdsInCurrentPage = currentSkills
                .filter(s => !isInstalled(s.id, s.name, s.githubUrl))
                .map(s => s.id);
              selectAllBatch(uninstalledIdsInCurrentPage);
            }}
            onClear={clearBatchSelect}
            isInstalling={isBatchInstalling}
          />
        )}
      </AnimatePresence>

      {(isLoading || (isSearchingSkillsSh && activeTab === 'skillssh')) && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/60">
            {isSearchingSkillsSh && activeTab === 'skillssh' ? t('searchingSkillsSh', { defaultValue: '正在搜索 skills.sh...' }) : t('loadingSkills')}
          </p>
        </div>
      )}

      {!isLoading && !(isSearchingSkillsSh && activeTab === 'skillssh') && (
        <>
          {/* Skills Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-4">
            {currentSkills.map((skill) => {
              const installed = isInstalled(skill.id, skill.name, skill.githubUrl);
              const isCurrentlyInstalling = installingSkillId === skill.id;
              const isSelected = batchSelectedSkills.includes(skill.id);
              return (
                <motion.div
                  key={skill.id}
                  layout
                  className={`group relative bg-white/50 dark:bg-gray-900/40 backdrop-blur-sm rounded-3xl border transition-all duration-500 overflow-hidden flex flex-col cursor-pointer hover:shadow-2xl hover:shadow-blue-500/10 ${
                    isSelected 
                      ? 'border-blue-500/50 ring-1 ring-blue-500/20 bg-blue-500/[0.03] scale-[1.01]' 
                      : 'border-white/20 dark:border-white/10 hover:border-blue-500/30'
                  }`}
                  onClick={() => {
                    if (batchMode && !installed) {
                      toggleBatchSelect(skill.id);
                    } else if (!batchMode) {
                      setSelectedSkill(skill);
                    }
                  }}
                >
                  <div className="p-6 flex-1 flex flex-col">
                    {/* Header with Checkbox */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        {batchMode && !installed && (
                          <motion.div
                            initial={false}
                            animate={{ scale: 1 }}
                            whileTap={{ scale: 0.8 }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                              isSelected 
                                ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/30' 
                                : 'bg-white/10 border-gray-300 dark:border-white/20 hover:border-blue-500/50'
                            }`}
                          >
                            {isSelected && <Check size={14} className="text-white" />}
                          </motion.div>
                        )}
                        <div className="p-3 bg-white dark:bg-white/10 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 group-hover:scale-110 transition-transform duration-500">
                          {skill.authorAvatar ? (
                            <img src={skill.authorAvatar} alt={skill.name} className="w-8 h-8 object-contain rounded-full" />
                          ) : (
                            <Sparkles className="w-8 h-8 text-blue-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center gap-1">
                          {skill.stars > 0 ? (
                            <><Star size={10} fill="currentColor" />{skill.stars.toLocaleString()}</>
                          ) : (
                            <><Download size={10} />{(skill.installs ?? 0).toLocaleString()}</>
                          )}
                        </span>
                        {showSourceBadge && skill.sourceType && skill.sourceType !== 'official' && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            skill.sourceType === 'custom'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          }`}>
                            {skill.sourceType === 'custom' ? t('sourceCustom') : 'skills.sh'}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <img src={skill.authorAvatar} alt={skill.author} className="w-5 h-5 rounded-full ring-1 ring-base-200" />
                          <span className="text-[10px] font-bold text-gray-400">{skill.author}</span>
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold mb-2 line-clamp-1">{skill.name}</h3>

                    {/* Description */}
                    <p className="text-sm text-base-content/60 line-clamp-3 mb-4 flex-1 leading-relaxed" title={getLocalizedDescription(skill, i18n.language)}>
                      {getLocalizedDescription(skill, i18n.language)}
                    </p>

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-4 border-t border-base-200">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleOpenSource(skill.githubUrl);
                        }}
                        className="h-10 px-4 flex items-center gap-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-xl bg-black/5 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 transition-all text-sm font-medium"
                      >
                        <ExternalLink size={14} />
                        {t('source')}
                      </motion.button>

                      {batchMode && !installed ? (
                        <div className={`h-10 flex items-center px-4 text-xs font-bold rounded-xl border transition-all ${
                          isSelected 
                            ? 'bg-blue-500 text-white border-transparent' 
                            : 'bg-black/5 dark:bg-white/5 text-gray-400 border-dashed border-gray-300 dark:border-white/10'
                        }`}>
                          {isSelected ? t('selected') : t('clickToSelect')}
                        </div>
                      ) : batchMode && installed ? (
                        <div className="h-10 flex items-center px-4 text-xs font-bold rounded-xl bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-white/5 cursor-not-allowed">
                          <Check size={12} className="mr-1.5" />
                          {t('installed')}
                        </div>
                      ) : !batchMode && (
                        <motion.button
                          whileHover={{ scale: 1.05, boxShadow: installed ? "0 10px 15px -3px rgba(20, 184, 166, 0.3)" : "0 10px 15px -3px rgba(16, 185, 129, 0.3)" }}
                          whileTap={{ scale: 0.95 }}
                          className={`h-10 px-5 flex items-center gap-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
                            installed
                              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 shadow-none hover:bg-teal-500/20'
                              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-600'
                          }`}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            openInstallConfirm(skill);
                          }}
                          disabled={!!installingSkillId}
                        >
                          {isCurrentlyInstalling ? (
                            <>
                              <span className="loading loading-spinner loading-xs"></span>
                              {installStatus.phase === 'scanning'
                                ? t('scanning')
                                : t('installing')}
                            </>
                          ) : installed ? (
                            <>
                              <RefreshCw size={14} />
                              {t('reinstall')}
                            </>
                          ) : (
                            <>
                              <Download size={16} />
                              {t('install')}
                            </>
                          )}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-12 pb-24">
              <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-2 rounded-2xl border border-gray-200/60 dark:border-white/10 backdrop-blur-md shadow-sm">
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 transition-all text-gray-500"
                  disabled={page === 1}
                  onClick={() => {
                    setPage(1);
                    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 transition-all text-gray-500"
                  disabled={page === 1}
                  onClick={() => {
                    setPage(p => Math.max(1, p - 1));
                    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-1.5 px-2">
                  {getPageNumbers().map((pageNum) => (
                    <button
                      key={pageNum}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all duration-300 ${
                        pageNum === page
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25 scale-105'
                          : 'hover:bg-black/10 dark:hover:bg-white/10 text-gray-500'
                      }`}
                      onClick={() => {
                        setPage(pageNum);
                        document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 transition-all text-gray-500"
                  disabled={page === totalPages}
                  onClick={() => {
                    setPage(p => Math.min(totalPages, p + 1));
                    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 transition-all text-gray-500"
                  disabled={page === totalPages}
                  onClick={() => {
                    setPage(totalPages);
                    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Install Confirm Modal */}
      <AnimatePresence>
        {installTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
              onClick={() => setInstallTarget(null)}
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
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10">
                    <Package size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {t('confirmInstall')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {installTarget.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setInstallTarget(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Skill Info */}
              {installTarget.description && (
                <div className="px-6 pb-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {getLocalizedDescription(installTarget, i18n.language)}
                  </p>
                </div>
              )}

              {/* Install Level Picker */}
              <div className="px-6 py-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {t('installLevelTitle')}
                </p>
                <InstallLevelPicker
                  value={installLevel}
                  onChange={setInstallLevel}
                  projectPaths={projectPaths}
                  selectedProjectIndices={selectedProjectIndices}
                  onProjectIndicesChange={setSelectedProjectIndices}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 px-6 pb-5">
                <button
                  onClick={() => setInstallTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl
                             border border-gray-200/60 dark:border-white/10
                             hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white
                             transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={async () => {
                    // Determine target install paths based on selected level
                    const targetPaths = installLevel === 'project' && selectedProjectIndices.length > 0
                      ? selectedProjectIndices.map(i => projectPaths[i])
                      : [DEFAULT_SYSTEM_SKILLS_PATH];

                    // Check which target paths already have this skill (parallel)
                    const checkResults = await Promise.all(
                      targetPaths.map(async (tp) => {
                        try {
                          const result: any = await invoke('check_skill_exists', {
                            request: { skillName: installTarget.name, installPath: tp }
                          });
                          return result.exists ? tp : null;
                        } catch (err) {
                          console.error(`Skill existence check failed for path ${tp}:`, err);
                          return null;
                        }
                      })
                    );
                    const existingPaths = checkResults.filter((p): p is string => p !== null);

                    // Only prompt overwrite for paths that already have the skill
                    if (existingPaths.length > 0) {
                      const pathLabels = existingPaths
                        .map(p => `  • ${p.split('/').pop() || p}`)
                        .join('\n');
                      const msg = t('overwriteExistingSkill', {
                        name: installTarget.name,
                        paths: pathLabels,
                        defaultValue: `"${installTarget.name}" already exists in:\n${pathLabels}\n\nOverwrite?`,
                      });
                      let confirmed = false;
                      try {
                        if ((window as any).__TAURI_INTERNALS__) {
                          const { confirm: tauriConfirm } = await import('@tauri-apps/plugin-dialog');
                          confirmed = await tauriConfirm(msg, {
                            title: t('overwriteConfirmTitle'),
                            okLabel: t('overwriteConfirm'),
                            cancelLabel: t('cancel'),
                          });
                        } else {
                          confirmed = window.confirm(msg);
                        }
                      } catch {
                        confirmed = window.confirm(msg);
                      }
                      if (!confirmed) return;
                    }

                    setInstallTarget(null);
                    if (installLevel !== 'project' || selectedProjectIndices.length === 0) {
                      handleInstall(installTarget, DEFAULT_SYSTEM_SKILLS_PATH);
                      return;
                    }
                    setInstallingSkillId(installTarget.id);
                    let successCount = 0;
                    let failCount = 0;
                    const total = selectedProjectIndices.length;
                    for (let i = 0; i < total; i++) {
                      const idx = selectedProjectIndices[i];
                      const path = projectPaths[idx];
                      setInstallStatus({
                        show: true,
                        phase: 'installing',
                        message: t('installingToProject', {
                          current: i + 1,
                          total,
                          path: path.split('/').pop()
                        }),
                        type: 'info'
                      });
                      try {
                        await installSkill(installTarget, path);
                        successCount++;
                      } catch (e) {
                        failCount++;
                        console.error(`Failed to install to ${path}:`, e);
                      }
                    }
                    setInstallStatus({
                      show: true,
                      phase: 'done',
                      message: failCount > 0
                        ? t('multiInstallPartial', { success: successCount, fail: failCount })
                        : t('multiInstallSuccess', { count: successCount }),
                      type: failCount > 0 ? 'warning' : 'success'
                    });
                    setInstallingSkillId(null);
                    setTimeout(() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' }), 5000);
                  }}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2"
                >
                  <Download size={14} />
                  {t('confirmInstall')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Install Confirm Modal */}
      <AnimatePresence>
        {showBatchConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
              onClick={() => setShowBatchConfirm(false)}
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
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                    <Package size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {t('confirmInstall')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('installingCount', { count: batchSelectedSkills.length })}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBatchConfirm(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Install Level Picker */}
              <div className="px-6 py-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {t('installLevelTitle')}
                </p>
                <InstallLevelPicker
                  value={installLevel}
                  onChange={setInstallLevel}
                  projectPaths={projectPaths}
                  selectedProjectIndices={selectedProjectIndices}
                  onProjectIndicesChange={setSelectedProjectIndices}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 px-6 pb-5">
                <button
                  onClick={() => setShowBatchConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl
                             border border-gray-200/60 dark:border-white/10
                             hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white
                             transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={async () => {
                    const paths = installLevel === 'project' && selectedProjectIndices.length > 0
                      ? selectedProjectIndices.map(i => projectPaths[i])
                      : [undefined];
                    handleBatchInstall(paths);
                  }}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2"
                >
                  <Download size={14} />
                  {t('installToProject', { count: batchSelectedSkills.length })}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </>
      )}

      {/* Skill Detail Drawer */}
      <SkillDetailDrawer
        skill={selectedSkill}
        isOpen={selectedSkill !== null}
        onClose={() => setSelectedSkill(null)}
        onInstall={(s) => { setSelectedSkill(null); openInstallConfirm(s); }}
        isInstalled={selectedSkill ? isInstalled(selectedSkill.id, selectedSkill.name, selectedSkill.githubUrl) : false}
      />
    </div>
  );
};

export default Marketplace;
