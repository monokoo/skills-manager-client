import { useTranslation } from 'react-i18next';
import { Globe, FolderOpen } from 'lucide-react';

export type InstallLevel = 'system' | 'project';

interface InstallLevelPickerProps {
  value: InstallLevel;
  onChange: (level: InstallLevel) => void;
  projectPaths: string[];
  selectedProjectIndex: number;
  onProjectIndexChange?: (index: number) => void;
  compact?: boolean;
}

export function InstallLevelPicker({
  value,
  onChange,
  projectPaths,
  selectedProjectIndex,
  onProjectIndexChange,
  compact = false,
}: InstallLevelPickerProps) {
  const { t } = useTranslation();

  const levels = [
    {
      id: 'system' as InstallLevel,
      label: t('systemGlobal'),
      desc: t('systemGlobalDesc'),
      icon: Globe,
    },
    {
      id: 'project' as InstallLevel,
      label: t('projectLevel'),
      desc: t('projectLevelDesc'),
      icon: FolderOpen,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Segment Control */}
      <div className="flex gap-2">
        {levels.map(level => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={`
              flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
              border transition-all duration-150
              ${value === level.id
                ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
              }
            `}
          >
            <level.icon size={16} />
            <span>{level.label}</span>
          </button>
        ))}
      </div>

      {/* Project Path Selector (only when project level selected) */}
      {value === 'project' && projectPaths.length > 0 && !compact && (
        <select
          value={selectedProjectIndex}
          onChange={e => onProjectIndexChange?.(Number(e.target.value))}
          className="
            w-full px-3 py-2 rounded-lg text-sm
            bg-gray-50 dark:bg-white/5
            border border-gray-200 dark:border-white/10
            text-gray-700 dark:text-gray-300
            focus:outline-none focus:ring-2 focus:ring-blue-500/30
          "
        >
          {projectPaths.map((path, i) => (
            <option key={i} value={i}>
              {path}
            </option>
          ))}
        </select>
      )}

      {value === 'project' && projectPaths.length === 0 && !compact && (
        <p className="text-xs text-amber-600 dark:text-amber-400 px-1">
          {t('noProjectPaths')}
        </p>
      )}
    </div>
  );
}
