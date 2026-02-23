import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink, Calendar, Download, FileText } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { parseFrontmatter } from '../../../lib/markdownUtils';
import type { InstalledSkill } from '../../../types';

interface MySkillDrawerProps {
  skill: InstalledSkill | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (id: string) => void;
  isUpdating?: boolean;
}

const formatDate = (timestamp?: number) => {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Reuse the same MarkdownContent pattern as SkillDetailDrawer
function MarkdownContent({ content }: { content: string }) {
  const { meta, body } = useMemo(() => parseFrontmatter(content), [content]);
  const metaEntries = Object.entries(meta);

  return (
    <>
      {metaEntries.length > 0 && (
        <div className="frontmatter-wrapper">
          <table className="frontmatter-table">
            <tbody>
              {metaEntries.map(([key, value]) => (
                <tr key={key}>
                  <td className="frontmatter-key">{key}</td>
                  <td className="frontmatter-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</Markdown>
    </>
  );
}

export const MySkillDrawer: React.FC<MySkillDrawerProps> = ({
  skill,
  isOpen,
  onClose,
  onUpdate,
  isUpdating = false,
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState('');

  // Load SKILL.md from local disk when opened
  useEffect(() => {
    if (!isOpen || !skill) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setContent('');
    setError('');

    invoke<string>('read_skill', { skillPath: skill.localPath })
      .then(text => {
        if (cancelled) return;
        setContent(text);
        setStatus('loaded');
      })
      .catch(err => {
        if (cancelled) return;
        setError(String(err));
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [isOpen, skill]);

  return (
    <AnimatePresence>
      {isOpen && skill && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop — same style as market drawer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer Panel — matching market drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-xl bg-white dark:bg-[#1E293B] border-l border-gray-200 dark:border-white/10 shadow-2xl h-full overflow-y-auto custom-scrollbar"
          >
            {/* Close Button — same positioning as market */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 transition-colors"
            >
              <X size={18} />
            </button>

            {status === 'loading' && (
              <div className="flex items-center justify-center h-64">
                <span className="loading loading-spinner loading-md text-emerald-500" />
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 p-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  {error || 'SKILL.md not found'}
                </p>
              </div>
            )}

            {status === 'loaded' && (
              <div className="p-6 space-y-6">
                {/* Header — similar layout to market */}
                <div className="flex items-start gap-4 pr-8">
                  <div className="p-3 bg-white dark:bg-white/10 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                      {skill.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                      {skill.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      {skill.author && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{skill.author}</p>
                      )}
                      {skill.version && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-full text-xs font-mono">
                          v{skill.version}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
                    <Calendar size={12} />
                    {formatDate(skill.installDate)}
                  </span>
                  {skill.type === 'system' ? (
                    <span className="inline-flex items-center px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold">
                      {t('system')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-semibold">
                      {t('project')}
                    </span>
                  )}
                </div>

                {/* Description */}
                {skill.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {skill.description}
                  </p>
                )}

                {/* Paths */}
                <div className="flex flex-wrap gap-1.5">
                  {(skill.localPaths || [skill.localPath]).map(p => (
                    <button
                      key={p}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono
                        bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400
                        rounded-lg border border-gray-200/60 dark:border-white/10
                        hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600
                        transition-colors truncate max-w-[40vw]"
                      title={p}
                      onClick={() => invoke('open_url', { url: `file:///${p}` }).catch(() => {})}
                    >
                      <FileText size={10} />
                      {p.replace(/^\/Users\/[^/]+/, '~')}
                    </button>
                  ))}
                </div>

                {/* Actions — matching market button style */}
                <div className="flex gap-3 pt-2">
                  {skill.sourceUrl && (
                    <button
                      onClick={() => invoke('open_url', { url: skill.sourceUrl })}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <ExternalLink size={14} />
                      {t('viewSource')}
                    </button>
                  )}
                  {skill.sourceUrl && onUpdate && (
                    <button
                      onClick={() => onUpdate(skill.id)}
                      disabled={isUpdating}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-md transition-all bg-gradient-to-br from-amber-500 to-orange-600 hover:shadow-amber-500/25"
                    >
                      {isUpdating ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Download size={14} />
                      )}
                      {t('reDownload')}
                    </button>
                  )}
                </div>

                {/* Document Content — same markdown-body class as market */}
                <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-gray-300 rounded-t-lg text-xs font-mono font-semibold border border-b-0 border-gray-200 dark:border-white/10">
                    <FileText size={12} />
                    SKILL.md
                  </div>
                  <div className="markdown-body">
                    <MarkdownContent content={content} />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MySkillDrawer;
