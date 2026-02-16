import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OverwriteConfirmDialogProps {
  open: boolean;
  skillName: string;
  existingPath: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OverwriteConfirmDialog({
  open,
  skillName,
  existingPath,
  onConfirm,
  onCancel,
}: OverwriteConfirmDialogProps) {
  const { t } = useTranslation();

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
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="p-6">
              {/* Warning Icon */}
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="text-amber-500" size={24} />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('overwriteTitle', { defaultValue: '检测到同名 Skill' })}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('overwriteDesc', {
                  name: skillName,
                  defaultValue: `"${skillName}" 已存在于以下路径，是否覆盖？`,
                })}
              </p>

              {/* Existing Path */}
              <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 mb-6">
                <code className="text-xs text-gray-600 dark:text-gray-400 break-all">
                  {existingPath}
                </code>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium
                    border border-gray-200 dark:border-white/10
                    text-gray-700 dark:text-gray-300
                    hover:bg-gray-50 dark:hover:bg-white/5
                    transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium
                    bg-amber-500 hover:bg-amber-600
                    text-white shadow-sm
                    transition-colors"
                >
                  {t('overwriteConfirm', { defaultValue: '覆盖安装' })}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
