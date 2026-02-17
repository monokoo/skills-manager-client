import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { Download, Star, ExternalLink, Check, Loader2, Shield, ShieldCheck, ShieldAlert, X, CheckSquare, Square, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles } from 'lucide-react';
import { SearchBox } from '../components/ui/SearchBox';
import { getLocalizedDescription } from '../utils/i18n';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

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
      className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl px-2 md:px-4"
    >
      <div className="bg-white/60 dark:bg-black/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-3xl p-2 md:p-3 shadow-2xl flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4 pl-1 md:pl-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden xs:block">{t('batchMode')}</span>
            <span className="text-xs md:text-sm font-black text-blue-500">
              {selectedCount} <span className="hidden sm:inline">{t('selected')}</span>
            </span>
          </div>
          <div className="h-6 md:h-8 w-px bg-gray-200 dark:bg-white/10" />
          <div className="flex gap-1 md:gap-2">
            <button
              onClick={onSelectAll}
              className="px-2 md:px-3 py-1 md:py-1.5 rounded-xl text-[10px] md:text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {t('selectAll')}
            </button>
            <button
              onClick={onClear}
              className="px-2 md:px-3 py-1 md:py-1.5 rounded-xl text-[10px] md:text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors whitespace-nowrap"
            >
              {t('clear')}
            </button>
          </div>
        </div>

        <button
          className="h-10 md:h-11 px-3 md:px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-xs md:text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
          onClick={onInstall}
          disabled={selectedCount === 0 || isInstalling}
        >
          {isInstalling ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Download size={16} className="md:w-[18px] md:h-[18px]" />
          )}
          <span className="hidden xs:inline">{t('installToProject', { count: selectedCount })}</span>
          <span className="xs:hidden">{t('install')}</span>
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
    isLoading
  } = useSkillStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const [isBatchInstalling, setIsBatchInstalling] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedSkills, setBatchSelectedSkills] = useState<string[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallStatus>({
    show: false,
    phase: 'idle',
    message: '',
    type: 'info'
  });
  const pageSize = 12;

  useEffect(() => {
    if (marketplaceSkills.length === 0) {
        fetchMarketplaceSkills();
    }
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

  const handleInstall = async (skill: any) => {
    if (installingSkillId) return;

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

      const result = await installSkill(skill);

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

  const handleBatchInstall = async () => {
    if (batchSelectedSkills.length === 0 || isBatchInstalling) return;

    const skillsToInstall = marketplaceSkills.filter(s => batchSelectedSkills.includes(s.id));
    if (skillsToInstall.length === 0) return;

    setIsBatchInstalling(true);
    setInstallStatus({
      show: true,
      phase: 'installing',
      message: t('installingCount', { count: skillsToInstall.length }),
      type: 'info'
    });

    let successCount = 0;
    let failCount = 0;

    try {
      for (const skill of skillsToInstall) {
        try {
          await installSkill(skill);
          successCount++;
        } catch (e) {
          failCount++;
          console.error(`Failed to install ${skill.name}:`, e);
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
    try {
        await invoke('open_url', { url });
    } catch (error) {
        console.error('Failed to open URL:', error);
        alert(t('openUrlError', { error }));
    }
  };

  const isInstalled = (skillId: string) => {
    return installedSkills.some(s => s.id === skillId);
  };

  const filteredSkills = marketplaceSkills.filter(skill =>
    skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="space-y-8">
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
                    <div className="flex items-center gap-2 mb-1">
                      <span>{t('securityScoreLabel')}</span>
                      <span className={`font-bold ${getScoreColor(installStatus.securityReport.score)}`}>
                        {installStatus.securityReport.score}/100
                      </span>
                    </div>
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

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('marketplace')}</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {t('marketplaceDesc')}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="stat-badge bg-primary/10 text-primary">
              {t('marketplaceSkillsCount', { count: marketplaceSkills.length })}
            </span>
            <span className="stat-badge bg-success/10 text-success">
              {t('installedCount', { count: installedSkills.length })}
            </span>
            <span className="stat-badge bg-orange-500/10 text-orange-500">
              Claude Code
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Batch Mode Toggle */}
          <button
            className={`flex items-center gap-2 px-4 h-11 rounded-2xl border transition-all duration-300 font-medium text-sm shadow-sm ${
              batchMode
                ? 'bg-blue-500 text-white border-transparent shadow-lg shadow-blue-500/25'
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

      {/* Batch Action Bar */}
      <AnimatePresence>
        {batchMode && (
          <BatchActionBar
            selectedCount={batchSelectedSkills.length}
            onInstall={handleBatchInstall}
            onSelectAll={() => {
              const uninstalledIdsInCurrentPage = currentSkills
                .filter(s => !isInstalled(s.id))
                .map(s => s.id);
              selectAllBatch(uninstalledIdsInCurrentPage);
            }}
            onClear={clearBatchSelect}
            isInstalling={isBatchInstalling}
          />
        )}
      </AnimatePresence>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/60">{t('loadingSkills')}</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Skills Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {currentSkills.map((skill) => {
              const installed = isInstalled(skill.id);
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
                          <Star size={10} fill="currentColor" />
                          {skill.stars.toLocaleString()}
                        </span>
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

                      {installed ? (
                        <div className="inline-flex items-center h-10 gap-1.5 px-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold border border-emerald-500/20">
                          <Check size={14} />
                          {t('installed')}
                        </div>
                      ) : batchMode ? (
                        <div className={`h-10 flex items-center px-4 text-xs font-bold rounded-xl border transition-all ${
                          isSelected 
                            ? 'bg-blue-500 text-white border-transparent' 
                            : 'bg-black/5 dark:bg-white/5 text-gray-400 border-dashed border-gray-300 dark:border-white/10'
                        }`}>
                          {isSelected ? t('selected') : t('clickToSelect')}
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.3)" }}
                          whileTap={{ scale: 0.95 }}
                          className="h-10 px-5 flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleInstall(skill);
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 transition-all text-gray-500"
                  disabled={page === 1}
                  onClick={() => {
                    setPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                        window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 transition-all text-gray-500"
                  disabled={page === totalPages}
                  onClick={() => {
                    setPage(totalPages);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Marketplace;
