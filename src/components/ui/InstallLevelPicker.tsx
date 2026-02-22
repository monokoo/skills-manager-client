import { useTranslation } from 'react-i18next';
import { Globe, FolderOpen } from 'lucide-react';

export type InstallLevel = 'system' | 'project';

interface InstallLevelPickerProps {
  value: InstallLevel;
  onChange: (level: InstallLevel) => void;
  projectPaths: string[];
  selectedProjectIndices: number[];
  onProjectIndicesChange?: (indices: number[]) => void;
  compact?: boolean;
}

export function InstallLevelPicker({
  value,
  onChange,
  projectPaths,
  selectedProjectIndices,
  onProjectIndicesChange,
  compact = false,
}: InstallLevelPickerProps) {
  const { t } = useTranslation();
  const noProjects = projectPaths.length === 0;

  const allSelected = projectPaths.length > 0 && selectedProjectIndices.length === projectPaths.length;

  const toggleIndex = (index: number) => {
    if (!onProjectIndicesChange) return;
    const next = selectedProjectIndices.includes(index)
      ? selectedProjectIndices.filter(i => i !== index)
      : [...selectedProjectIndices, index];
    onProjectIndicesChange(next);
  };

  const toggleAll = () => {
    if (!onProjectIndicesChange) return;
    onProjectIndicesChange(
      allSelected ? [] : projectPaths.map((_, i) => i)
    );
  };

  const levels = [
    {
      id: 'system' as InstallLevel,
      label: t('systemGlobal'),
      desc: t('systemGlobalDesc'),
      icon: Globe,
      disabled: false,
    },
    {
      id: 'project' as InstallLevel,
      label: t('projectLevel'),
      desc: t('projectLevelDesc'),
      icon: FolderOpen,
      disabled: noProjects,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Segment Control */}
      <div className="flex gap-2">
        {levels.map(level => (
          <button
            key={level.id}
            onClick={() => !level.disabled && onChange(level.id)}
            disabled={level.disabled}
            className={`
              flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
              border transition-all duration-150
              ${level.disabled
                ? 'border-gray-200/50 dark:border-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                : value === level.id
                  ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
              }
            `}
          >
            <level.icon size={16} />
            <span>{level.label}</span>
          </button>
        ))}
      </div>

      {/* Project Path Checkbox List */}
      {value === 'project' && projectPaths.length > 0 && !compact && (
        <div className="space-y-1.5">
          {/* Select All */}
          {projectPaths.length > 1 && (
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={!onProjectIndicesChange}
                className="checkbox checkbox-xs checkbox-primary rounded"
              />
              {t('selectAll', { defaultValue: '全选' })}
            </label>
          )}

          {/* Path items */}
          {projectPaths.map((path, i) => (
            <label
              key={i}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer
                transition-colors
                ${selectedProjectIndices.includes(i)
                  ? 'bg-blue-500/10 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                }
              `}
            >
              <input
                type="checkbox"
                checked={selectedProjectIndices.includes(i)}
                onChange={() => toggleIndex(i)}
                disabled={!onProjectIndicesChange}
                className="checkbox checkbox-xs checkbox-primary rounded"
              />
              <span className="truncate font-mono text-xs">{path}</span>
            </label>
          ))}
        </div>
      )}

      {noProjects && !compact && (
        <p className="text-xs text-amber-600 dark:text-amber-400 px-1">
          {t('noProjectPaths')}
        </p>
      )}
    </div>
  );
}
