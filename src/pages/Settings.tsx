import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { Plus, X, FolderOpen, ExternalLink, Package, Check, Cpu, Settings2, Palette, AlertTriangle, Globe, Link2, Link2Off, RefreshCw, Monitor, CheckCircle2, Github, Heart, MessageCircle, Terminal, Database } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const agentColors: Record<string, string> = {
  'claude-code': 'bg-orange-500',
  'github-copilot': 'bg-gray-800',
  'cursor': 'bg-cyan-400',
  'codex': 'bg-green-500',
  'opencode': 'bg-indigo-500',
  'antigravity': 'bg-blue-500',
  'gemini-cli': 'bg-purple-500',
  'windsurf': 'bg-emerald-500',
  'amp': 'bg-red-400',
  'roo': 'bg-amber-500',
  'trae': 'bg-pink-500',
};

// --- Reusable style helpers ---
const toggleClasses = (checked: boolean) =>
  `relative ml-4 w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`;

const toggleThumbClasses = (checked: boolean) =>
  `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`;

const RadioIndicator = ({ checked, size = 'md' }: { checked: boolean; size?: 'sm' | 'md' }) => {
  const d = size === 'sm' ? { o: 'w-4 h-4', i: 'w-1.5 h-1.5' } : { o: 'w-5 h-5', i: 'w-2 h-2' };
  return (
    <div className={`${d.o} rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
      {checked && <div className={`${d.i} rounded-full bg-white`} />}
    </div>
  );
};

const PRIMARY_BTN = 'h-9 px-4 flex items-center gap-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none';

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

const Settings = () => {
  const { t } = useTranslation();
  const {
    projectPaths,
    fetchProjectPaths,
    saveProjectPaths,
    defaultInstallLocation,
    setDefaultInstallLocation,
    marketplaceSkills,
    selectedProjectIndex,
    setSelectedProjectIndex,
    agents,
    symlinkStatuses,
    platform,
    fetchAgents,
    fetchSymlinkAgents,
    checkSymlinkStatus,
    createSymlink,
    createAllSymlinks,
    removeSymlink,
    getPlatformInfo,
    officialSourceEnabled,
    showSourceBadge,
    setOfficialSourceEnabled,
    setShowSourceBadge,
  } = useSkillStore();
  const [paths, setPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState('');
  const [isCreatingSymlinks, setIsCreatingSymlinks] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    native: false,
    symlink: true,
    install: false,
    paths: false,
    dataSource: false,
    appearance: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    fetchProjectPaths();
    fetchAgents();
    fetchSymlinkAgents();
    checkSymlinkStatus();
    getPlatformInfo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPaths(projectPaths);
  }, [projectPaths]);

  const handleAddPath = async () => {
    if (newPath && !paths.includes(newPath)) {
      const updatedPaths = [...paths, newPath];
      setPaths(updatedPaths);
      setNewPath('');
      try {
        await saveProjectPaths(updatedPaths);
      } catch (error) {
        console.error('Failed to save paths:', error);
        alert(t('saveError'));
      }
    }
  };

  const handleRemovePath = async (pathToRemove: string) => {
    const updatedPaths = paths.filter(p => p !== pathToRemove);
    setPaths(updatedPaths);
    try {
      await saveProjectPaths(updatedPaths);
    } catch (error) {
      console.error('Failed to save paths:', error);
      alert(t('saveError'));
    }
  };

  const handleCreateAllSymlinks = async () => {
    setIsCreatingSymlinks(true);
    try {
      await createAllSymlinks();
    } catch (error) {
      console.error('Failed to create symlinks:', error);
    } finally {
      setIsCreatingSymlinks(false);
    }
  };

  const handleCreateSymlink = async (agentId: string) => {
    setActionInProgress(agentId);
    try {
      await createSymlink(agentId);
    } catch (error) {
      console.error(`Failed to create symlink for ${agentId}:`, error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemoveSymlink = async (agentId: string) => {
    setActionInProgress(agentId);
    try {
      await removeSymlink(agentId);
    } catch (error) {
      console.error(`Failed to remove symlink for ${agentId}:`, error);
    } finally {
      setActionInProgress(null);
    }
  };

  const getSymlinkStatus = (agentId: string) => {
    return symlinkStatuses.find(s => s.agentId === agentId);
  };

  // Filter agents by compatibility
  const nativeAgents = agents.filter(a => a.compatibility === 'native');
  const symlinkRequiredAgents = agents.filter(a => a.compatibility === 'symlink');

  // Count linked agents
  const linkedCount = symlinkRequiredAgents.filter(a => {
    const status = getSymlinkStatus(a.id);
    return status?.exists && status?.isValid;
  }).length;

  return (
    <div className="flex gap-6 max-w-7xl">
      {/* Left: Settings Sections */}
      <div className="flex-1 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl shrink-0">
            <Settings2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t('settings')}</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {platform ? (
                <span className="flex items-center gap-1">
                  <Monitor size={12} />
                  {platform.os.toUpperCase()} · {platform.arch}
                  {platform.os === 'windows' && (
                    <span className="text-amber-500 flex items-center gap-1 ml-2">
                      <AlertTriangle size={12} />
                      {t('adminRequired')}
                    </span>
                  )}
                </span>
              ) : (
                <span>{t('systemConfig')}</span>
              )}
            </p>
          </div>
        </div>

        {/* Native Compatible Agents */}
        <div className="collapse collapse-arrow bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10">
          <input
            type="checkbox"
            checked={expandedSections.native}
            onChange={() => toggleSection('native')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-success/10 rounded-lg">
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {t('nativeAgents')}
                </span>
                <span className="ml-2 text-xs text-base-content/50">
                  {t('agentsCount', { count: nativeAgents.length })}
                </span>
              </div>
              <div className="flex -space-x-1">
                {nativeAgents.slice(0, 5).map(agent => (
                  <div
                    key={agent.id}
                    className={`w-5 h-5 rounded-full ${agentColors[agent.id] || 'bg-gray-500'} border-2 border-base-100`}
                    title={agent.displayName}
                  />
                ))}
                {nativeAgents.length > 5 && (
                  <div className="w-5 h-5 rounded-full bg-base-300 border-2 border-base-100 flex items-center justify-center text-[10px]">
                    +{nativeAgents.length - 5}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 grid grid-cols-2 lg:grid-cols-3 gap-2">
              {nativeAgents.map(agent => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 p-2 bg-base-100 rounded-xl"
                >
                  <div className={`w-3 h-3 rounded-full ${agentColors[agent.id] || 'bg-gray-500'}`} />
                  <span className="text-sm font-medium truncate">{agent.displayName}</span>
                  <Check size={12} className="text-success ml-auto shrink-0" />
                </div>
              ))}
            </div>
            <p className="text-xs text-base-content/50 mt-3">
              {t('nativeAgentsDesc')}
            </p>
          </div>
        </div>

        {/* Symlink Configuration */}
        <div className="collapse collapse-arrow bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10">
          <input
            type="checkbox"
            checked={expandedSections.symlink}
            onChange={() => toggleSection('symlink')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Link2 size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {t('symlinkConfig')}
                </span>
                <span className="ml-2 text-xs text-base-content/50">
                  {t('linkedCountLabel', { count: linkedCount, total: symlinkRequiredAgents.length })}
                </span>
              </div>
              {linkedCount < symlinkRequiredAgents.length && (
                <span className="stat-badge bg-warning/20 text-warning text-xs">
                  {t('pendingConfig', { count: symlinkRequiredAgents.length - linkedCount })}
                </span>
              )}
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-2">
              {symlinkRequiredAgents.map(agent => {
                const status = getSymlinkStatus(agent.id);
                const isLinked = status?.exists && status?.isValid;
                const isLoading = actionInProgress === agent.id;

                return (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isLinked ? 'bg-success/5 border border-success/20' : 'bg-base-100 border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${agentColors[agent.id] || 'bg-gray-500'}`}>
                      <Cpu size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{agent.displayName}</div>
                      <div className="text-xs text-base-content/40 font-mono truncate">
                        ~/{agent.globalSkillsDir}
                      </div>
                      {status?.error && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-error bg-error/5 p-1 rounded border border-error/20">
                          <AlertTriangle size={10} />
                          <span className="truncate" title={status.error}>{status.error}</span>
                        </div>
                      )}
                    </div>
                    {isLinked ? (
                      <button
                        className="h-7 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all duration-200 disabled:opacity-50"
                        onClick={() => handleRemoveSymlink(agent.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Link2Off size={12} />
                        )}
                        {t('remove')}
                      </button>
                    ) : (
                      <button
                        className="h-7 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all duration-200 disabled:opacity-50"
                        onClick={() => handleCreateSymlink(agent.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Link2 size={12} />
                        )}
                        {t('confirm')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                className={PRIMARY_BTN}
                onClick={handleCreateAllSymlinks}
                disabled={isCreatingSymlinks}
              >
                {isCreatingSymlinks ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Link2 size={15} />
                )}
                {t('setupAll')}
              </button>
              <button
                className="h-9 px-4 flex items-center gap-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-black/5 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
                onClick={() => checkSymlinkStatus()}
              >
                <RefreshCw size={15} />
                {t('refresh')}
              </button>
            </div>
          </div>
        </div>

        {/* Installation Settings */}
        <div className="collapse collapse-arrow bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10">
          <input
            type="checkbox"
            checked={expandedSections.install}
            onChange={() => toggleSection('install')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-accent/10 rounded-lg">
                <Globe size={16} className="text-accent" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {t('installSettings')}
                </span>
              </div>
              <span className="stat-badge bg-base-300 text-xs">
                {defaultInstallLocation === 'system'
                  ? t('global')
                  : t('project')
                }
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-2">
              {/* System Directory Option */}
              <div
                className={`rounded-xl p-3 cursor-pointer transition-all border ${
                  defaultInstallLocation === 'system'
                    ? 'border-primary bg-primary/5'
                    : 'border-base-300 hover:border-base-400 bg-base-100'
                }`}
                onClick={() => setDefaultInstallLocation('system')}
              >
                <div className="flex items-center gap-3">
                  <RadioIndicator checked={defaultInstallLocation === 'system'} />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {t('systemGlobalDir')}
                      <span className="stat-badge bg-success/10 text-success text-xs">
                        {t('recommended')}
                      </span>
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      ~/.claude/skills • {t('accessibleToAll')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Project Directory Option */}
              <div
                className={`rounded-xl p-3 cursor-pointer transition-all border ${
                  defaultInstallLocation === 'project'
                    ? 'border-primary bg-primary/5'
                    : 'border-base-300 hover:border-base-400 bg-base-100'
                }`}
                onClick={() => setDefaultInstallLocation('project')}
              >
                <div className="flex items-center gap-3">
                  <RadioIndicator checked={defaultInstallLocation === 'project'} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {t('projectSpecificDir')}
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {t('projectInstallTip')}
                    </p>
                    {projectPaths.length > 0 && (
                      <div className="mt-2 p-2 bg-base-200/50 rounded-lg border border-base-300/50">
                        <div className="flex items-center gap-2 text-[10px] text-base-content/40 uppercase font-bold tracking-wider">
                          <Terminal size={10} />
                          {t('finalInstallPath')}
                        </div>
                        <div className="text-xs font-mono text-primary mt-1 break-all">
                          {projectPaths[selectedProjectIndex] || projectPaths[0]}
                          <span className="text-base-content/30">/SkillName</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {defaultInstallLocation === 'project' && projectPaths.length > 0 && (
                  <div className="mt-3 ml-7 space-y-1">
                    {projectPaths.map((path, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                          selectedProjectIndex === index
                            ? 'bg-primary/10 border border-primary'
                            : 'bg-base-200 hover:bg-base-300 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProjectIndex(index);
                        }}
                      >
                        <RadioIndicator checked={selectedProjectIndex === index} size="sm" />
                        <input
                          type="radio"
                          name="selected-project"
                          className="sr-only"
                          checked={selectedProjectIndex === index}
                          onChange={() => setSelectedProjectIndex(index)}
                        />
                        <FolderOpen size={12} className="text-base-content/50" />
                        <span className="font-mono truncate" title={path}>{path}</span>
                      </label>
                    ))}
                  </div>
                )}

                {defaultInstallLocation === 'project' && projectPaths.length === 0 && (
                  <div className="mt-2 ml-7 text-xs text-warning flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {t('addPathFirst')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Paths */}
        <div className="collapse collapse-arrow bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10">
          <input
            type="checkbox"
            checked={expandedSections.paths}
            onChange={() => toggleSection('paths')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-warning/10 rounded-lg">
                <FolderOpen size={16} className="text-warning" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">{t('projectPaths')}</span>
              </div>
              <span className="stat-badge bg-base-300 text-xs">
                {t('agentsCount', { count: paths.length })}
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-2">
              {paths.length === 0 ? (
                <div className="text-center py-6 text-base-content/40 border border-dashed border-base-300 rounded-xl text-sm">
                  {t('noProjectPaths')}
                </div>
              ) : (
                paths.map((path, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-base-100 rounded-xl group"
                  >
                    <FolderOpen size={14} className="text-warning shrink-0" />
                    <span className="flex-1 font-mono text-xs truncate">{path}</span>
                    <button
                      className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemovePath(path)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
              <div className="flex gap-2 mt-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={t('enterProjectPath')}
                    className="h-9 w-full pl-4 pr-10 bg-black/5 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
                  />
                  {isTauri && (
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-all duration-200"
                      title={t('selectFolder')}
                      onClick={async () => {
                        try {
                          const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
                          const selected = await openDialog({
                            directory: true,
                            multiple: false,
                          });
                          if (selected && typeof selected === 'string') {
                            setNewPath(selected);
                          }
                        } catch (err) {
                          console.error('Failed to open directory dialog:', err);
                        }
                      }}
                    >
                      <FolderOpen size={15} />
                    </button>
                  )}
                </div>
                <button
                  className={PRIMARY_BTN}
                  onClick={handleAddPath}
                  disabled={!newPath.trim()}
                >
                  <Plus size={15} />
                  {t('add')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Source Management */}
        <div className="collapse collapse-arrow bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10">
          <input
            type="checkbox"
            checked={expandedSections.dataSource}
            onChange={() => toggleSection('dataSource')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Database size={16} className="text-blue-500" />
              </div>
              <span className="font-semibold">
                {t('dataSourceManagement')}
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-3">
              {/* Official Source Toggle */}
              <div className="flex items-center justify-between p-3 bg-base-100 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t('officialSourceToggle')}</div>
                  <p className="text-xs text-base-content/50 mt-0.5">{t('officialSourceDesc')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={officialSourceEnabled}
                  className={toggleClasses(officialSourceEnabled)}
                  onClick={() => setOfficialSourceEnabled(!officialSourceEnabled)}
                >
                  <span className={toggleThumbClasses(officialSourceEnabled)} />
                </button>
              </div>

              {/* Show Source Badge Toggle */}
              <div className="flex items-center justify-between p-3 bg-base-100 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t('showSourceBadge')}</div>
                  <p className="text-xs text-base-content/50 mt-0.5">{t('showSourceBadgeDesc')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showSourceBadge}
                  className={toggleClasses(showSourceBadge)}
                  onClick={() => setShowSourceBadge(!showSourceBadge)}
                >
                  <span className={toggleThumbClasses(showSourceBadge)} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="collapse collapse-arrow bg-white dark:bg-white/5 rounded-2xl border border-gray-200/60 dark:border-white/10">
          <input
            type="checkbox"
            checked={expandedSections.appearance}
            onChange={() => toggleSection('appearance')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-secondary/10 rounded-lg">
                <Palette size={16} className="text-secondary" />
              </div>
              <span className="font-semibold">
                {t('appearance')}
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-base-content/70">{t('theme')}</span>
                <select className="h-8 px-3 pr-8 bg-black/5 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all duration-200 appearance-none cursor-pointer">
                  <option>{t('followSystem')}</option>
                  <option>{t('light')}</option>
                  <option>{t('dark')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: About & Related */}
      <div className="w-72 shrink-0 space-y-4">
        <div className="sticky top-4 space-y-4">
          {/* About Card */}
          <div className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-gray-200/60 dark:border-white/10">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Package size={16} className="text-primary" />
              {t('about')}
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-base-content/60">{t('version')}</span>
                <span className="font-mono font-semibold">v1.2.3</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-base-content/60">Skills</span>
                <span className="stat-badge bg-primary/10 text-primary text-xs">{marketplaceSkills.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-base-content/60">{t('agents')}</span>
                <span className="stat-badge bg-accent/10 text-accent text-xs">{agents.length}</span>
              </div>

              <div className="divider my-2"></div>

              <a
                href="#"
                className="flex items-center gap-2 text-base-content/70 hover:text-primary transition-colors"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/buzhangsan/skills-manager-client' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <Github size={14} />
                <span>GitHub</span>
                <ExternalLink size={12} className="ml-auto" />
              </a>

              <a
                href="#"
                className="flex items-center gap-2 text-base-content/70 hover:text-primary transition-colors"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/buzhangsan/skills-manager-client/issues' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <Heart size={14} />
                <span>{t('feedback')}</span>
                <ExternalLink size={12} className="ml-auto" />
              </a>
            </div>
          </div>

          {/* Related Projects Card */}
          <div className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-gray-200/60 dark:border-white/10">
            <h3 className="font-bold mb-4">
              {t('relatedProjects')}
            </h3>

            <div className="space-y-3">
              {/* skill-manager (Python CLI) */}
              <a
                href="#"
                className="block p-3 bg-base-100 rounded-xl hover:bg-base-200 transition-colors group"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/buzhangsan/skill-manager' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg shrink-0">
                    <Terminal size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1">
                      skill-manager
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {t('skillManagerDesc')}
                    </p>
                  </div>
                </div>
              </a>

              <div className="divider my-2 text-xs text-base-content/40">
                {t('community')}
              </div>

              {/* Join Group */}
              <a
                href="#"
                className="block p-3 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl hover:from-primary/20 hover:to-accent/20 transition-colors group border border-primary/20"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/buzhangsan/skills-manager-client/issues/1' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg shrink-0">
                    <MessageCircle size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1">
                      {t('joinCommunity')}
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {t('feedbackSuggestions')}
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
