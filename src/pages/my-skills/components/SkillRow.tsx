import React from 'react';
import { 
  Trash2, Eye, FolderOpen, Github, HardDrive, Package, 
  ExternalLink, RefreshCw, Calendar, CheckCircle, AlertCircle,
  CheckSquare, Square, Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { SkillRowProps } from '../types';

/**
 * 格式化日期 (抽离至外部避免组件内重复定义)
 */
const formatDate = (timestamp?: number) => {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * 获取来源图标
 */
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

/**
 * 获取来源标签
 */
const getSourceLabel = (source: string | undefined, t: (key: string) => string) => {
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

export const SkillRow: React.FC<SkillRowProps> = React.memo(({
  skill,
  isSelected,
  isUpdating,
  onToggleSelect,
  onView,
  onUninstall,
  onUpdate
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors min-w-[700px] ${
        isSelected ? 'bg-emerald-50 dark:bg-emerald-500/5' : ''
      }`}
    >
      {/* Checkbox */}
      <button
        className="shrink-0"
        onClick={() => onToggleSelect(skill.id)}
      >
        {isSelected ? (
          <CheckSquare size={16} className="text-emerald-500" />
        ) : (
          <Square size={16} className="text-base-content/40" />
        )}
      </button>

      {/* Name, Description & Paths */}
      <div className="flex-1 min-w-[180px]">
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
                  hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400
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
      <div className="w-24 shrink-0 flex items-center justify-center">
        {skill.sourceUrl ? (
          <button
            className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
            onClick={() => invoke('open_url', { url: skill.sourceUrl })}
            title={skill.sourceUrl}
          >
            {getSourceIcon(skill.source)}
            <span>{getSourceLabel(skill.source, t)}</span>
            <ExternalLink size={10} />
          </button>
        ) : (
          <div className="flex items-center gap-1 text-xs text-base-content/60">
            {getSourceIcon(skill.source)}
            <span>{getSourceLabel(skill.source, t)}</span>
          </div>
        )}
      </div>

      {/* Install Date */}
      <div className="w-40 shrink-0 flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Calendar size={12} />
        <span className="font-mono">{formatDate(skill.installDate)}</span>
      </div>

      {/* Status */}
      <div className="w-20 shrink-0 flex justify-center">
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

      {/* Actions */}
      <div className="shrink-0 min-w-[60px] flex items-center justify-end gap-1 pr-2">
        {/* Update button for skills with available updates */}
        {skill.hasUpdate && (
          <button
            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            onClick={() => onUpdate(skill.id)}
            disabled={isUpdating}
            title={t('update')}
          >
            {isUpdating ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Download size={14} />
            )}
          </button>
        )}
        <button
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-500/10 transition-colors"
          onClick={() => onView(skill)}
          title={t('view')}
        >
          <Eye size={14} />
        </button>
        <button
          className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
          onClick={() => onUninstall(skill)}
          title={t('remove')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

SkillRow.displayName = 'SkillRow';
