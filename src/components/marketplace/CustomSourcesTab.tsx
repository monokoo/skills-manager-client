import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../../store/useSkillStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, RefreshCw, Github, ExternalLink,
  CheckCircle2, AlertCircle, Loader2, Clock, X, FolderGit2
} from 'lucide-react';
import type { CustomSource } from '../../types';

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusBadge({ source }: { source: CustomSource }) {
  const { t } = useTranslation();
  const config = {
    synced: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Synced' },
    syncing: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: t('syncingSource') },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: t('indexFailed') },
    pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: t('indexing') },
  };
  const c = config[source.status] || config.synced;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.color}`}>
      <Icon size={12} className={source.status === 'syncing' ? 'animate-spin' : ''} />
      {c.label}
    </span>
  );
}

export default function CustomSourcesTab() {
  const { t } = useTranslation();
  const {
    customSources, customMarketplaceSkills,
    isLoadingCustom, isSyncingSource,
    addCustomSource, removeCustomSource, refreshCustomSource,
  } = useSkillStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setIsAdding(true);
    setAddError('');
    try {
      await addCustomSource(newUrl.trim());
      setNewUrl('');
      setShowAddModal(false);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Unknown error';
      if (msg.includes('already exists')) {
        setAddError(t('sourceAlreadyExists'));
      } else {
        setAddError(msg);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeCustomSource(id);
    } catch {
      // silent
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="stat-badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {customSources.length} {t('customSources')}
          </span>
          <span className="stat-badge bg-blue-500/10 text-blue-600 dark:text-blue-400">
            {customMarketplaceSkills.length} Skills
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshCustomSource()}
            disabled={!!isSyncingSource}
            className="flex items-center gap-2 px-4 h-10 rounded-xl border border-gray-200/60 dark:border-white/10
                       bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300
                       hover:bg-black/10 dark:hover:bg-white/10 transition-all text-sm font-medium
                       disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncingSource ? 'animate-spin' : ''} />
            {t('refreshAll')}
          </button>
          <button
            onClick={() => { setShowAddModal(true); setAddError(''); setNewUrl(''); }}
            className="flex items-center gap-2 px-4 h-10 rounded-xl
                       bg-gradient-to-r from-emerald-500 to-teal-500 text-white
                       hover:from-emerald-600 hover:to-teal-600 transition-all text-sm font-medium
                       shadow-lg shadow-emerald-500/25"
          >
            <Plus size={14} />
            {t('addSource')}
          </button>
        </div>
      </div>

      {/* Source Cards or Empty State */}
      {isLoadingCustom ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      ) : customSources.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl mb-4">
            <FolderGit2 size={48} className="text-emerald-500/60" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('noCustomSources')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
            {t('addSourceHint')}
          </p>
          <button
            onClick={() => { setShowAddModal(true); setAddError(''); setNewUrl(''); }}
            className="flex items-center gap-2 px-6 h-11 rounded-xl
                       bg-gradient-to-r from-emerald-500 to-teal-500 text-white
                       hover:from-emerald-600 hover:to-teal-600 transition-all font-medium
                       shadow-lg shadow-emerald-500/25"
          >
            <Plus size={16} />
            {t('addSource')}
          </button>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {customSources.map((source, i) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ delay: i * 0.05 }}
                className="relative group p-5 rounded-2xl border border-gray-200/60 dark:border-white/10
                           bg-white/60 dark:bg-white/5 backdrop-blur-sm
                           hover:shadow-lg hover:shadow-emerald-500/5 hover:border-emerald-500/30
                           transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="p-2.5 bg-gradient-to-br from-emerald-500/10 to-teal-400/10 rounded-xl flex-shrink-0">
                      <Github size={24} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {source.owner}/{source.repo}
                        </h3>
                        {source.subpath && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                            /{source.subpath}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <StatusBadge source={source} />
                        <span>{t('skillsFound', { count: source.skillCount })}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {t('lastSynced')}: {formatRelativeTime(source.lastSyncAt)}
                        </span>
                        <span className="font-mono text-[10px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                          {source.branch}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm btn-circle"
                      title="Open in GitHub"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => refreshCustomSource(source.id)}
                      disabled={isSyncingSource === source.id}
                      className="btn btn-ghost btn-sm btn-circle"
                      title={t('refreshAll')}
                    >
                      <RefreshCw size={14} className={isSyncingSource === source.id ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(source.id)}
                      className="btn btn-ghost btn-sm btn-circle text-red-500 hover:bg-red-500/10"
                      title={t('removeSource')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Source Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#1A1F2E] rounded-2xl border border-gray-200/60 dark:border-white/10
                         shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-200/60 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                    <Github size={18} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('addSource')}</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-sm btn-circle">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => { setNewUrl(e.target.value); setAddError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder={t('enterSourceUrl')}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5
                             border border-gray-200/60 dark:border-white/10
                             text-gray-900 dark:text-white placeholder-gray-400
                             focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
                             transition-all"
                    autoFocus
                    disabled={isAdding}
                  />
                  {addError && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle size={14} /> {addError}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p className="font-medium">Supported formats:</p>
                  <code className="block bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 text-[11px]">
                    https://github.com/owner/repo<br />
                    https://github.com/owner/repo/tree/main/skills
                  </code>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200/60 dark:border-white/10">
                <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-sm rounded-xl px-4">
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newUrl.trim() || isAdding}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl
                             bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm
                             hover:from-emerald-600 hover:to-teal-600 transition-all
                             shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {isAdding ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t('indexing')}
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      {t('addSource')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1A1F2E] rounded-2xl border border-gray-200/60 dark:border-white/10
                         shadow-2xl w-full max-w-sm mx-4 p-6 text-center"
            >
              <div className="p-3 bg-red-500/10 rounded-full inline-flex mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('removeSource')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('confirmRemoveSource')}</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost btn-sm rounded-xl px-4">
                  Cancel
                </button>
                <button
                  onClick={() => handleRemove(deleteConfirm)}
                  className="btn btn-error btn-sm rounded-xl px-4 text-white"
                >
                  <Trash2 size={14} className="mr-1" />
                  {t('removeSource')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
