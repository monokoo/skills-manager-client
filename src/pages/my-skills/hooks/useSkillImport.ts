import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { InstallLevel } from '../../../components/ui/InstallLevelPicker';

/** Store 切片：useSkillImport 仅依赖这些属性 */
interface SkillStoreSlice {
  analyzeGithubRepo: (url: string) => Promise<any>;
  analyzeLocalFolder: (path: string) => Promise<any>;
  analysisResult: any;
  importSelectedSkills: (sourcePath: string, selectedPaths: string[], sourceUrl: string, installPath?: string) => Promise<{ success: boolean; message?: string }>;
  clearAnalysisResult: () => void;
  projectPaths: string[];
  defaultInstallLocation?: string;
}

// Default system skills directory (must match backend PRIMARY_SKILLS_DIR)
const DEFAULT_SKILLS_DIR = '~/.claude/skills';

/**
 * Hook for managing the skill import flow (github/local)
 */
export const useSkillImport = (
  store: SkillStoreSlice,
  showToast: (success: boolean, message: string) => void,
  t: (key: string, options?: any) => string
) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'github' | 'local' | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importPath, setImportPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importLevel, setImportLevel] = useState<InstallLevel>(
    (store.defaultInstallLocation as InstallLevel) || 'system'
  );
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<Set<string>>(new Set());
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Synchronous mutex lock to prevent concurrent imports
  const importLockRef = useRef(false);

  const translateBackendError = useCallback((msg: string) => {
    const errorMap: Record<string, string> = {
      'Invalid URL': t('error.invalidUrl'),
      'Invalid GitHub URL': t('error.invalidGithubUrl'),
      'Source directory not found': t('error.sourceDirNotFound'),
      'Temporary import directory not found': t('error.tempDirNotFound'),
      'Cannot determine skills directory': t('error.cannotDetermineSkillsDir'),
      'No skill paths provided': t('error.noSkillPathsProvided'),
      'Source path does not exist': t('error.sourcePathNotExist'),
      'SKILL.md not found': t('error.skillMdNotFound'),
      'ZIP extract failed': t('error.zipExtractFailed'),
      'Invalid ZIP file': t('error.invalidZipFile'),
    };
    for (const [key, value] of Object.entries(errorMap)) {
      if (msg.includes(key)) return value;
    }
    if (msg.includes('Not Found')) return t('repoNotFound');
    if (msg.includes('Permission denied')) return t('permissionDenied');
    if (msg.includes('git clone') || msg.includes('Git clone')) return t('error.gitCloneFailed');
    if (msg.includes('git') && msg.includes('failed')) return t('error.gitCommandFailed');
    return msg;
  }, [t]);

  const handleAnalyzeGitHub = useCallback(async (url: string) => {
    if (!url.trim()) {
      setFormError(t('enterGithubUrl'));
      return;
    }
    setFormError(null);
    setAnalysisError(null);
    try {
      const result = await store.analyzeGithubRepo(url);
      if (result.success) {
        const allPaths = new Set<string>(result.skills.map((s: any) => s.path));
        setSelectedSkillPaths(allPaths);
      } else {
        setAnalysisError(translateBackendError(result.message));
      }
    } catch (err: any) {
      setAnalysisError(translateBackendError(err.message || String(err)));
    }
  }, [store, translateBackendError, t]);

  const handleAnalyzeLocal = useCallback(async (path: string) => {
    if (!path.trim()) {
      setFormError(t('enterLocalPath'));
      return;
    }
    setFormError(null);
    setAnalysisError(null);
    try {
      const result = await store.analyzeLocalFolder(path);
      if (result.success) {
        if (result.skills.length === 0) {
          setAnalysisError(t('noSkillFound'));
        } else {
          const allPaths = new Set<string>(result.skills.map((s: any) => s.path));
          setSelectedSkillPaths(allPaths);
        }
      } else {
        setAnalysisError(translateBackendError(result.message));
      }
    } catch (err: any) {
      setAnalysisError(translateBackendError(err.message || String(err)));
    }
  }, [store, translateBackendError, t]);

  const handleImport = useCallback(async (params: {
    type: 'github' | 'local';
    url?: string;
    path?: string;
    selectedPaths: Set<string>;
    level: string;
    projectIndices: number[];
  }) => {
    // Synchronous ref guard — immune to React's async state batching
    if (importLockRef.current) return;
    importLockRef.current = true;

    try {
      const { analysisResult, importSelectedSkills, projectPaths } = store;

      if (!analysisResult) return;

      if (params.selectedPaths.size === 0) {
        setAnalysisError(t('pleaseSelectSkill'));
        return;
      }

      // Overwrite check — resolve actual install paths and check each target directory
      const installPaths = params.level === 'project' && projectPaths.length > 0 && params.projectIndices.length > 0
        ? params.projectIndices.map(i => projectPaths[i] || projectPaths[0])
        : [DEFAULT_SKILLS_DIR];

      const selectedSkills = analysisResult.skills.filter(
        (s: any) => params.selectedPaths.has(s.path)
      );

      const existingSkills: any[] = [];
      for (const skill of selectedSkills) {
        let found = false;
        for (const installPath of installPaths) {
          try {
            const result: any = await invoke('check_skill_exists', {
              request: { skillName: skill.name, installPath }
            });
            if (result.exists) {
              found = true;
              break;
            }
          } catch {
            // Ignore check errors, treat as non-existing
          }
        }
        if (found) {
          existingSkills.push(skill);
        }
      }
      if (existingSkills.length > 0) {
        const names = existingSkills.map((s: any) => `  • ${s.name}`).join('\n');
        let confirmed = false;
        try {
          if ((window as any).__TAURI_INTERNALS__) {
            const { confirm: tauriConfirm } = await import('@tauri-apps/plugin-dialog');
            confirmed = await tauriConfirm(
              t('importOverwriteConfirm', { names }),
              {
                title: t('overwriteConfirmTitle'),
                okLabel: t('confirmOverwrite'),
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

      // Only show "importing" AFTER user has confirmed
      setIsImporting(true);

      const paths = params.level === 'project' && projectPaths.length > 0 && params.projectIndices.length > 0
        ? params.projectIndices.map(i => projectPaths[i] || projectPaths[0])
        : [undefined];

      const sourcePath = params.type === 'local'
        ? (analysisResult.tempPath || params.path || '')
        : analysisResult.tempPath;
      let successCount = 0;
      let failCount = 0;
      let lastMessage = '';

      for (const importInstallPath of paths) {
        try {
          const result = await importSelectedSkills(
            sourcePath,
            Array.from(params.selectedPaths),
            params.type === 'github' ? (params.url || '') : '',
            importInstallPath
          );
          if (result?.success) {
            successCount++;
            lastMessage = result.message || '';
          } else {
            failCount++;
            lastMessage = result?.message || '';
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        showToast(true, t(params.type === 'local' ? 'importSuccessLocal' : 'importSuccessGitHub'));
        setShowImportModal(false);
        setImportType(null);
        setSelectedSkillPaths(new Set());
        store.clearAnalysisResult();
      } else if (successCount > 0 && failCount > 0) {
        showToast(true, t('multiInstallPartial', { success: successCount, fail: failCount }));
        setShowImportModal(false);
        setImportType(null);
        setSelectedSkillPaths(new Set());
        store.clearAnalysisResult();
      } else {
        setAnalysisError(translateBackendError(lastMessage || ''));
      }
    } catch (error: any) {
      setAnalysisError(translateBackendError(error.message || String(error)));
    } finally {
      setIsImporting(false);
      importLockRef.current = false;
      // Cleanup ZIP temp directories
      try {
        const tempPath = store.analysisResult?.tempPath;
        if (tempPath && typeof tempPath === 'string' && tempPath.includes('.skill_zip_')) {
          await invoke('cleanup_temp_import', { tempPath });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [store, showToast, translateBackendError, t]);

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setImportType(null);
    setImportUrl('');
    setImportPath('');
    store.clearAnalysisResult();
    setSelectedSkillPaths(new Set());
    setAnalysisError(null);
    setFormError(null);
  }, [store]);

  return {
    showImportModal,
    setShowImportModal,
    importType,
    setImportType,
    importUrl,
    setImportUrl,
    importPath,
    setImportPath,
    isImporting,
    importLevel,
    setImportLevel,
    selectedSkillPaths,
    setSelectedSkillPaths,
    analysisError,
    setAnalysisError,
    formError,
    setFormError,
    handleAnalyzeGitHub,
    handleAnalyzeLocal,
    handleImport,
    closeImportModal
  };
};
