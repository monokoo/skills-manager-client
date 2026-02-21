import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type SourceFilter = 'all' | 'official' | 'custom' | 'skillssh';

interface SourceFilterDropdownProps {
  value: SourceFilter;
  onChange: (value: SourceFilter) => void;
  officialEnabled: boolean;
}

export default function SourceFilterDropdown({
  value,
  onChange,
  officialEnabled,
}: SourceFilterDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options: {
    value: SourceFilter;
    label: string;
    hidden?: boolean;
    disabled?: boolean;
    badge?: string;
  }[] = [
    { value: 'all', label: t('sourceAll') },
    { value: 'official', label: t('sourceOfficial'), hidden: !officialEnabled },
    { value: 'custom', label: t('sourceCustom') },
    { value: 'skillssh', label: 'skills.sh' },
  ];

  const visibleOptions = options.filter((o) => !o.hidden);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? t('sourceAll');

  const handleSelect = (opt: (typeof options)[0]) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 h-10 rounded-xl
                   border border-gray-200/60 dark:border-white/10
                   bg-white/60 dark:bg-white/5 backdrop-blur-sm
                   text-sm font-medium text-gray-700 dark:text-gray-200
                   hover:bg-white/80 dark:hover:bg-white/10 transition-all
                   min-w-[100px] whitespace-nowrap"
      >
        <span>{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 mt-1.5 min-w-[180px]
                       bg-white/90 dark:bg-[#1A1F2E]/95 backdrop-blur-xl
                       border border-gray-200/60 dark:border-white/10
                       rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30
                       overflow-hidden"
          >
            {visibleOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt)}
                disabled={opt.disabled}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors
                  ${opt.disabled
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : value === opt.value
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
              >
                <span className="flex items-center gap-2">
                  {opt.label}
                  {opt.badge && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5
                                     rounded-full bg-gray-100 dark:bg-white/10
                                     text-gray-400 dark:text-gray-500 font-medium">
                      <Lock size={9} />
                      {opt.badge}
                    </span>
                  )}
                </span>
                {value === opt.value && !opt.disabled && (
                  <Check size={14} className="text-blue-500" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
