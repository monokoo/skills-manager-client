import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeletePathsModalProps } from '../types';

export const DeletePathsModal: React.FC<DeletePathsModalProps> = ({
  isOpen,
  skill,
  selectedPaths,
  isDeleting,
  onClose,
  onTogglePath,
  onConfirm
}) => {
  const { t } = useTranslation();

  if (!isOpen || !skill) return null;

  const allPaths = skill.localPaths || [skill.localPath];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          onClick={onClose}
        />
        
        {/* Modal Card */}
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
                  {skill.name}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
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
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {allPaths.map((p, i) => {
                const isChecked = selectedPaths.has(p);
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
                      onChange={() => onTogglePath(p)}
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
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={selectedPaths.size === 0 || isDeleting}
              className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
            >
              {isDeleting && <span className="loading loading-spinner loading-xs" />}
              <Trash2 size={14} />
              {t('confirmDelete', { count: selectedPaths.size })}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
