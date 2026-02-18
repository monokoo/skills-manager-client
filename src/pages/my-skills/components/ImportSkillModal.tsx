import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Github, HardDrive, AlertCircle, BookOpen,
  CheckCircle2, FolderOpen, CheckSquare, Square
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InstallLevelPicker } from '../../../components/ui/InstallLevelPicker';
import type { ImportSkillModalProps } from '../types';

export const ImportSkillModal: React.FC<ImportSkillModalProps> = ({
  isOpen,
  onClose,
  importType,
  setImportType,
  importUrl,
  setImportUrl,
  importPath,
  setImportPath,
  importLevel,
  setImportLevel,
  selectedSkillPaths,
  setSelectedSkillPaths,
  formError,
  setFormError,
  analysisError,
  setAnalysisError,
  isAnalyzing,
  isImporting,
  analysisResult,
  projectPaths,
  selectedProjectIndex,
  onAnalyzeGitHub,
  onAnalyzeLocal,
  onImport,
  onClearAnalysis,
  onProjectIndexChange
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const toggleSelectSkill = (path: string) => {
    const newSet = new Set(selectedSkillPaths);
    if (newSet.has(path)) newSet.delete(path);
    else newSet.add(path);
    setSelectedSkillPaths(newSet);
  };

  const toggleSelectAllSkills = () => {
    if (!analysisResult) return;
    if (selectedSkillPaths.size === analysisResult.skills.length) {
      setSelectedSkillPaths(new Set());
    } else {
      setSelectedSkillPaths(new Set(analysisResult.skills.map((s: any) => s.path)));
    }
  };

  const handleAnalyze = () => {
    if (importType === 'github') {
      onAnalyzeGitHub(importUrl);
    } else if (importType === 'local') {
      onAnalyzeLocal(importPath);
    }
  };

  const handleStartImport = () => {
    onImport({
      type: importType as 'github' | 'local',
      url: importUrl,
      path: importPath,
      selectedPaths: selectedSkillPaths,
      level: importLevel,
      projectIndex: selectedProjectIndex
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl
            rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 pb-2">
            <h3 className="font-bold text-xl flex items-center gap-2">
              {importType === 'github' && <Github size={20} className="text-blue-500" />}
              {importType === 'local' && <HardDrive size={20} className="text-blue-500" />}
              {!importType ? t('importSkill') : importType === 'github' ? t('importFromGitHub') : t('importFromLocal')}
            </h3>
            <button
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 pt-0">
            {/* Tip text below header for github/local */}
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
                  onClick={() => setImportType('github')}
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
                  onClick={() => setImportType('local')}
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
              <div className="space-y-4">
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
                          focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500/15
                          transition-all duration-300 font-mono text-xs shadow-inner
                          placeholder:text-base-content/20
                          ${formError && importType === 'github' ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500/50' : ''}`}
                        value={importUrl}
                        onChange={(e) => {
                          setImportUrl(e.target.value);
                          if (analysisResult) onClearAnalysis();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && importUrl.trim()) {
                            handleAnalyze();
                          }
                        }}
                        autoFocus
                      />

                      {/* Tip / Error zone — only when no analysis results */}
                      <AnimatePresence mode="wait">
                        {formError && importType === 'github' ? (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-1.5 flex items-center gap-1.5 text-red-500 text-[11px] font-medium overflow-hidden"
                          >
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{formError}</span>
                          </motion.div>
                        ) : (
                          !analysisResult && (
                            <motion.div
                              key="tip"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-1.5 flex items-center gap-1.5 text-base-content/30 dark:text-gray-500 text-[11px] italic overflow-hidden"
                            >
                              <AlertCircle size={12} className="shrink-0 opacity-50" />
                              <span>{t('repoMustContainSkill')}</span>
                            </motion.div>
                          )
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Analysis Results */}
                    <AnimatePresence>
                      {analysisResult && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-3 overflow-hidden"
                        >
                          <div className="flex justify-between items-center">
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
                            <div className="flex items-center gap-1.5">
                              <AnimatePresence mode="wait">
                                {selectedSkillPaths.size > 0 && (
                                  <motion.span
                                    key="selected"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold"
                                  >
                                    {t('nSelected', { count: selectedSkillPaths.size })}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-bold">
                                {t('nFound', { count: analysisResult.skills.length })}
                              </span>
                            </div>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar p-1">
                            {analysisResult.skills.length === 0 ? (
                              <div className="text-center py-8 text-gray-400 text-sm">
                                {t('noSkillFoundInRepo')}
                              </div>
                            ) : analysisResult.skills.map((skill: any, index: number) => (
                              <motion.div
                                key={skill.path}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border group overflow-hidden
                                  ${selectedSkillPaths.has(skill.path)
                                    ? 'bg-blue-50/80 dark:bg-blue-500/10 border-blue-200/50 dark:border-blue-500/20 shadow-sm ring-1 ring-blue-500/10'
                                    : 'bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-sm'}`}
                                onClick={() => toggleSelectSkill(skill.path)}
                                title={skill.description?.trim() || undefined}
                              >
                                {/* Selection Indicator Bar */}
                                {selectedSkillPaths.has(skill.path) && (
                                  <motion.div
                                    layoutId="selection-bar"
                                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500"
                                  />
                                )}

                                {/* Icon */}
                                <div className={`shrink-0 p-1.5 rounded-lg transition-colors
                                  ${selectedSkillPaths.has(skill.path)
                                    ? 'bg-blue-500 text-white shadow-blue-500/20 shadow-lg'
                                    : 'bg-black/5 dark:bg-white/10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                                  <BookOpen size={16} strokeWidth={2.5} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <span className={`font-bold text-sm tracking-tight ${selectedSkillPaths.has(skill.path) ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {skill.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
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
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  /* Local Path Input */
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
                          className={`input w-full h-12 pl-4 pr-11 bg-black/5 dark:bg-white/5
                            border-gray-200/60 dark:border-white/10 rounded-2xl
                            focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500/15
                            transition-all duration-300 font-mono text-xs shadow-inner
                            placeholder:text-base-content/20
                            ${formError && importType === 'local' ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500/50' : ''}`}
                          value={importPath}
                          onChange={(e) => {
                            setImportPath(e.target.value);
                            if (formError) setFormError(null);
                            if (analysisResult) onClearAnalysis();
                          }}
                          autoFocus
                        />
                        <button
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5
                            hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors
                            text-base-content/40 hover:text-blue-500"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              if ((window as any).__TAURI_INTERNALS__) {
                                const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
                                const selected = await openDialog({
                                  directory: true,
                                  multiple: false,
                                });
                                if (selected && typeof selected === 'string') {
                                  setImportPath(selected);
                                  if (formError) setFormError(null);
                                  if (analysisResult) onClearAnalysis();
                                }
                              } else {
                                setFormError(t('nativeDialogOnlyInApp'));
                              }
                            } catch (err) {
                              console.error('Failed to open directory dialog:', err);
                            }
                          }}
                        >
                          <FolderOpen size={16} />
                        </button>
                      </div>

                      {/* Tip / Error zone */}
                      <AnimatePresence mode="wait">
                        {formError && importType === 'local' ? (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-1.5 flex items-center gap-1.5 text-red-500 text-[11px] font-medium overflow-hidden"
                          >
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{formError}</span>
                          </motion.div>
                        ) : (
                          !analysisResult && (
                            <motion.div
                              key="tip"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-1.5 flex items-center gap-1.5 text-base-content/30 dark:text-gray-500 text-[11px] italic overflow-hidden"
                            >
                              <AlertCircle size={12} className="shrink-0 opacity-50" />
                              <span>{t('folderMustContainSkill')}</span>
                            </motion.div>
                          )
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Analysis Error */}
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
                      value={importLevel as any}
                      onChange={setImportLevel as any}
                      projectPaths={projectPaths}
                      selectedProjectIndex={selectedProjectIndex}
                      onProjectIndexChange={onProjectIndexChange}
                    />
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    onClick={() => {
                      if (analysisResult) {
                        onClearAnalysis();
                        setImportUrl('');
                        setImportPath('');
                        setSelectedSkillPaths(new Set());
                      } else {
                        setImportType(null);
                        setImportUrl('');
                        setImportPath('');
                      }
                      setAnalysisError(null);
                      setFormError(null);
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
                      transition-all duration-300 min-w-[100px]
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (!analysisResult && !isImporting) {
                        handleAnalyze();
                      } else {
                        handleStartImport();
                      }
                    }}
                    disabled={
                      isAnalyzing ||
                      isImporting ||
                      (!!analysisResult && (analysisResult.skills.length === 0 || selectedSkillPaths.size === 0))
                    }
                  >
                    {(isImporting || isAnalyzing) && <span className="loading loading-spinner loading-xs mr-2" />}
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
    </AnimatePresence>
  );
};
