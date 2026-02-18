import React from 'react';
import { X, Calendar, ExternalLink, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Github, Package, HardDrive, FolderOpen } from 'lucide-react';
import type { ViewSkillModalProps } from '../types';

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

export const ViewSkillModal: React.FC<ViewSkillModalProps & { 
  onUpdate?: (id: string) => void,
  isUpdating?: boolean 
}> = ({
  isOpen,
  skill,
  content,
  onClose,
  onUpdate,
  isUpdating = false
}) => {
  const { t } = useTranslation();

  if (!isOpen || !skill) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-base-200 bg-base-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-xl flex items-center gap-2">
              {skill.name}
              {skill.version && (
                <span className="badge badge-ghost badge-sm font-mono">v{skill.version}</span>
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-xs text-base-content/50 font-mono">
                {skill.localPath}
              </span>
            </div>
            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-base-content/60">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDate(skill.installDate)}
              </span>
              {skill.sourceUrl ? (
                <button
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={() => invoke('open_url', { url: skill.sourceUrl })}
                >
                  {getSourceIcon(skill.source)}
                  {getSourceLabel(skill.source, t)}
                  <ExternalLink size={10} />
                </button>
              ) : (
                <span className="flex items-center gap-1">
                  {getSourceIcon(skill.source)}
                  {getSourceLabel(skill.source, t)}
                </span>
              )}
              {skill.author && (
                <span className="flex items-center gap-1">
                  {t('author')}: {skill.author}
                </span>
              )}
            </div>
          </div>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-base-200 p-6">
          <div className="prose prose-sm max-w-none bg-base-100 p-6 rounded-xl shadow-sm">
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-mono bg-transparent">
              {content || t('loading')}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-200 bg-base-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            {skill.sourceUrl && onUpdate && (
              <>
                <button
                  className="btn btn-ghost btn-sm gap-2 rounded-xl"
                  onClick={() => invoke('open_url', { url: skill.sourceUrl })}
                >
                  <ExternalLink size={14} />
                  {t('viewSource')}
                </button>
                <button
                  className="btn btn-primary btn-sm gap-2 rounded-xl"
                  onClick={() => onUpdate(skill.id)}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
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
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
