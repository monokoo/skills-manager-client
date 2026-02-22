import { useTranslation } from 'react-i18next';
import { Globe, FolderOpen, Check } from 'lucide-react';

export type InstallLevel = 'system' | 'project';

interface InstallLevelPickerProps {
  value: InstallLevel;
  onChange: (level: InstallLevel) => void;
  projectPaths: string[];
  selectedProjectIndices: number[];
  onProjectIndicesChange?: (indices: number[]) => void;
  compact?: boolean;
}

function CustomCheckbox({ checked, onChange, disabled, size = 16 }: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => { e.preventDefault(); if (!disabled) onChange(); }}
      disabled={disabled}
      className={`
        shrink-0 flex items-center justify-center rounded-md border-2 transition-all duration-150
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${checked
          ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/30'
          : 'bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 hover:border-emerald-400 dark:hover:border-emerald-400/50'
        }
      `}
      style={{ width: size, height: size }}
    >
      {checked && <Check size={size - 4} strokeWidth={3} className="text-white" />}
    </button>
  );
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
                  ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400'
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
            <div
              onClick={toggleAll}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400
                         cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <CustomCheckbox checked={allSelected} onChange={toggleAll} disabled={!onProjectIndicesChange} size={14} />
              {t('selectAll', { defaultValue: '全选' })}
            </div>
          )}

          {/* Path items */}
          {projectPaths.map((path, i) => {
            const isSelected = selectedProjectIndices.includes(i);
            return (
              <div
                key={i}
                onClick={() => toggleIndex(i)}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm cursor-pointer
                  border transition-all duration-150
                  ${isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                  }
                `}
              >
                <CustomCheckbox checked={isSelected} onChange={() => toggleIndex(i)} disabled={!onProjectIndicesChange} />
                <span className="truncate font-mono text-xs">{path}</span>
              </div>
            );
          })}
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
