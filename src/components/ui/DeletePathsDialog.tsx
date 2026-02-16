import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeletePathsDialogProps {
  open: boolean;
  skillName: string;
  paths: string[];
  onConfirm: (selectedPaths: string[]) => void;
  onCancel: () => void;
}

export function DeletePathsDialog({
  open,
  skillName,
  paths,
  onConfirm,
  onCancel,
}: DeletePathsDialogProps) {
  const { t } = useTranslation();
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set(paths));
  const [confirmText, setConfirmText] = useState('');

  const canConfirm = useMemo(
    () => selectedPaths.size > 0 && confirmText === skillName,
    [selectedPaths.size, confirmText, skillName]
  );

  const togglePath = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(Array.from(selectedPaths));
    }
  };

  const handleClose = () => {
    setSelectedPaths(new Set(paths));
    setConfirmText('');
    onCancel();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="text-red-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('deleteTitle', { defaultValue: '删除 Skill' })}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {skillName}
                  </p>
                </div>
              </div>

              {/* Path Selection */}
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('selectPathsToDelete', { defaultValue: '选择要删除的安装路径：' })}
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {paths.map(path => (
                    <label
                      key={path}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                        border transition-all duration-150
                        ${selectedPaths.has(path)
                          ? 'border-red-500/50 bg-red-500/5 dark:bg-red-400/10'
                          : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPaths.has(path)}
                        onChange={() => togglePath(path)}
                        className="checkbox checkbox-sm checkbox-error"
                      />
                      <code className="text-xs text-gray-600 dark:text-gray-400 break-all flex-1">
                        {path}
                      </code>
                    </label>
                  ))}
                </div>
              </div>

              {/* Danger Zone - Confirm by typing */}
              <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    {t('dangerZone', { defaultValue: '危险操作' })}
                  </span>
                </div>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-2">
                  {t('typeToConfirm', {
                    name: skillName,
                    defaultValue: `请输入 "${skillName}" 以确认删除：`,
                  })}
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={skillName}
                  className="
                    w-full px-3 py-2 rounded-lg text-sm
                    bg-white dark:bg-[#0F172A]
                    border border-red-200 dark:border-red-500/30
                    text-gray-900 dark:text-white
                    placeholder:text-gray-400/-40
                    focus:outline-none focus:ring-2 focus:ring-red-500/30
                  "
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium
                    border border-gray-200 dark:border-white/10
                    text-gray-700 dark:text-gray-300
                    hover:bg-gray-50 dark:hover:bg-white/5
                    transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className={`
                    flex-1 px-4 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150
                    ${canConfirm
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm'
                      : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    }
                  `}
                >
                  {t('confirmDelete', {
                    count: selectedPaths.size,
                    defaultValue: `删除 ${selectedPaths.size} 个路径`,
                  })}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
