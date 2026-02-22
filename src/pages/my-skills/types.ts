import type { InstalledSkill } from '../../types';
import type { InstallLevel } from '../../components/ui/InstallLevelPicker';

export interface SkillRowProps {
  skill: InstalledSkill;
  isSelected: boolean;
  isUpdating: boolean;
  onToggleSelect: (id: string) => void;
  onView: (skill: InstalledSkill) => void;
  onUninstall: (skill: InstalledSkill) => void;
  onUpdate: (id: string) => void;
}

export interface ViewSkillModalProps {
  isOpen: boolean;
  skill: InstalledSkill | null;
  content: string;
  onClose: () => void;
}

export interface DeletePathsModalProps {
  isOpen: boolean;
  skill: InstalledSkill | null;
  selectedPaths: Set<string>;
  isDeleting: boolean;
  onClose: () => void;
  onTogglePath: (path: string) => void;
  onConfirm: () => Promise<void>;
}

export interface ImportSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Import hook 暴露的状态
  importType: 'github' | 'local' | null;
  setImportType: (type: 'github' | 'local' | null) => void;
  importUrl: string;
  setImportUrl: (url: string) => void;
  importPath: string;
  setImportPath: (path: string) => void;
  importLevel: InstallLevel;
  setImportLevel: (level: InstallLevel) => void;
  selectedSkillPaths: Set<string>;
  setSelectedSkillPaths: (paths: Set<string>) => void;
  formError: string | null;
  setFormError: (error: string | null) => void;
  analysisError: string | null;
  setAnalysisError: (error: string | null) => void;
  // Store 注入
  isAnalyzing: boolean;
  isImporting: boolean;
  analysisResult: any;
  projectPaths: string[];
  selectedProjectIndices: number[];
  // 操作
  onAnalyzeGitHub: (url: string) => Promise<void>;
  onAnalyzeLocal: (path: string) => Promise<void>;
  onImport: (params: {
    type: 'github' | 'local';
    url?: string;
    path?: string;
    selectedPaths: Set<string>;
    level: string;
    projectIndices: number[];
  }) => Promise<void>;
  onClearAnalysis: () => void;
  onProjectIndicesChange: (indices: number[]) => void;
}
