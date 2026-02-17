import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';
import { useSkillStore } from '../store/useSkillStore';
import { invoke } from '@tauri-apps/api/core';
import SecurityReportCard from '../components/SecurityReportCard';
import { BentoGrid } from '../components/ui/BentoGrid';
import { GlassCard, GlassCardHeader } from '../components/ui/GlassCard';

interface SecurityIssue {
  ruleId: string;
  ruleName: string;
  file: string;
  line: number;
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  confidence: 'low' | 'medium' | 'high';
}

interface SecurityReport {
  skillId: string;
  score: number;
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  issues: SecurityIssue[];
  blocked: boolean;
  recommendations: string[];
  scannedFiles: string[];
}

const Security = () => {
  const { t } = useTranslation();
  const { installedSkills } = useSkillStore();
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SecurityReport | null>(null);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result: SecurityReport[] = await invoke('scan_all_skills_security');
      setReports(result);
      setLastScan(new Date());
    } catch (error) {
      console.error('Security scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (installedSkills.length > 0 && reports.length === 0) {
      handleScan();
    }
  }, [installedSkills]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalIssues = reports.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalCount = reports.filter(r => r.level === 'critical' || r.blocked).length;
  const highCount = reports.filter(r => r.level === 'high').length;
  const safeCount = reports.filter(r => r.level === 'safe' || r.level === 'low').length;

  const getOverallStatus = () => {
    if (criticalCount > 0) return { text: t('securityStatusAtRisk'), color: 'text-red-500', bgColor: 'bg-red-500', icon: XCircle };
    if (highCount > 0) return { text: t('securityStatusAttention'), color: 'text-amber-500', bgColor: 'bg-amber-500', icon: AlertTriangle };
    return { text: t('safe'), color: 'text-emerald-500', bgColor: 'bg-emerald-500', icon: ShieldCheck };
  };

  const overallStatus = getOverallStatus();
  const StatusIcon = overallStatus.icon;

  const getReportForSkill = (skillPath: string) =>
    reports.find(r => skillPath.includes(r.skillId) || r.skillId === skillPath.split(/[\\/]/).pop());

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
      high: 'bg-red-500/10 text-red-600 dark:text-red-400',
      medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      safe: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
    const labels: Record<string, string> = {
      critical: t('critical'), high: t('high'), medium: t('medium'),
      low: t('low'), safe: t('safe'),
    };
    return (
      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${styles[level] || 'bg-gray-100 text-gray-500'}`}>
        {labels[level] || t('unknown')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('securityCenterTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('securityCenterDesc')}</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className={`
            flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-semibold
            transition-all duration-200 shadow-sm
            ${scanning
              ? 'bg-black/5 dark:bg-white/10 text-gray-400 cursor-not-allowed border border-gray-200/60 dark:border-white/10'
              : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25 border-none'
            }
          `}
        >
          {scanning ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          {scanning ? t('scanning') : t('scanNow')}
        </button>
      </div>

      {/* Stats */}
      <BentoGrid columns={4} gap={4}>
        <GlassCard className="text-center">
          <StatusIcon size={32} className={`${overallStatus.color} mx-auto mb-2`} />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('systemStatus')}</p>
          <p className={`text-sm font-semibold ${overallStatus.color} mt-1`}>{overallStatus.text}</p>
          {lastScan && (
            <p className="text-[11px] text-gray-400 mt-1">{t('lastScan')}: {lastScan.toLocaleTimeString()}</p>
          )}
        </GlassCard>

        <GlassCard className="text-center">
          <Shield size={32} className="text-blue-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('scanned')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{reports.length}</p>
        </GlassCard>

        <GlassCard className="text-center">
          <ShieldCheck size={32} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('safe')}</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{safeCount}</p>
        </GlassCard>

        <GlassCard className="text-center">
          <ShieldAlert size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('issuesFound')}</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{totalIssues}</p>
          {criticalCount > 0 && (
            <p className="text-[11px] text-red-500 mt-1">{criticalCount} {t('critical')}</p>
          )}
        </GlassCard>
      </BentoGrid>

      {/* Report Detail */}
      {selectedReport && (
        <SecurityReportCard
          report={{
            skillId: selectedReport.skillId,
            score: selectedReport.score,
            level: selectedReport.level,
            issues: selectedReport.issues.map(issue => {
              const severityMap: Record<string, 'critical' | 'error' | 'warning' | 'info'> = {
                critical: 'critical', high: 'error', medium: 'warning', low: 'info',
              };
              return {
                severity: severityMap[issue.severity] || 'info',
                category: issue.category,
                description: issue.description,
                lineNumber: issue.line,
                codeSnippet: issue.code,
                filePath: issue.file,
                confidence: issue.confidence,
              };
            }),
            recommendations: selectedReport.recommendations,
            blocked: selectedReport.blocked,
            scannedFiles: selectedReport.scannedFiles,
          }}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {/* Results Table */}
      <GlassCard padding="lg">
        <GlassCardHeader title={t('scanResults')} />
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5">
                <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Skill</th>
                <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('score')}</th>
                <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('riskLevel')}</th>
                <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('issues')}</th>
                <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {installedSkills.map(skill => {
                const report = getReportForSkill(skill.localPath || skill.id);
                return (
                  <tr key={skill.id} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{skill.name}</td>
                    <td className="py-3 px-3">
                      {report ? (
                        <span className={`font-bold ${
                          report.score >= 90 ? 'text-emerald-500' :
                          report.score >= 70 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {report.score}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {report ? getLevelBadge(report.level) : (
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-400">
                          {t('notScanned')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {report ? (
                        <span className={report.issues.length > 0 ? 'text-amber-500 font-medium' : 'text-gray-500'}>
                          {report.issues.length}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {report && (
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                        >
                          {t('viewReport')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {installedSkills.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-12">
                    {t('noSkillsInstalled')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

export default Security;
