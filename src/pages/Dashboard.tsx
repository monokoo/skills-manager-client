import { useEffect } from 'react';
import { useSkillStore } from '../store/useSkillStore';
import { ShieldCheck, Zap, Box, HardDrive, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { BentoGrid, BentoItem } from '../components/ui/BentoGrid';
import { GlassCard, GlassCardHeader } from '../components/ui/GlassCard';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  desc: string;
}

const StatCard = ({ title, value, icon: Icon, gradient, desc }: StatCardProps) => (
  <GlassCard className="relative overflow-hidden">
    <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] opacity-10 ${gradient}`} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{desc}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gradient}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </GlassCard>
);

const ActivityItem = ({ text, time, active }: { text: string; time: string; active?: boolean }) => (
  <div className="flex items-start gap-3 py-2.5">
    <div className="relative mt-1.5">
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-tight">{text}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{time}</p>
    </div>
    {active && <ArrowUpRight size={14} className="text-blue-500 mt-0.5 flex-none" />}
  </div>
);

const Dashboard = () => {
  const { t } = useTranslation();
  const { scanLocalSkills, installedSkills } = useSkillStore();

  const data = [
    { name: t('mon'), usage: 40 },
    { name: t('tue'), usage: 30 },
    { name: t('wed'), usage: 20 },
    { name: t('thu'), usage: 27 },
    { name: t('fri'), usage: 18 },
    { name: t('sat'), usage: 23 },
    { name: t('sun'), usage: 34 },
  ];

  useEffect(() => {
    scanLocalSkills();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const systemCount = installedSkills.filter(s => s.type === 'system').length;
  const projectCount = installedSkills.filter(s => s.type === 'project').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('allActiveSkills')}
        </p>
      </div>

      {/* Stats Row */}
      <BentoGrid columns={4} gap={4}>
        <StatCard
          title={t('installedSkills')}
          value={installedSkills.length}
          icon={Zap}
          gradient="bg-gradient-to-br from-blue-500 to-cyan-400"
          desc={t('allActiveSkills')}
        />
        <StatCard
          title={t('systemLevel')}
          value={systemCount}
          icon={HardDrive}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-400"
          desc={t('globallyAvailable')}
        />
        <StatCard
          title={t('projectLevel')}
          value={projectCount}
          icon={Box}
          gradient="bg-gradient-to-br from-amber-500 to-orange-400"
          desc={t('currentProjectOnly')}
        />
        <StatCard
          title={t('securityStatus')}
          value={t('safe')}
          icon={ShieldCheck}
          gradient="bg-gradient-to-br from-green-500 to-emerald-400"
          desc={t('noRisksFound')}
        />
      </BentoGrid>

      {/* Chart + Activity */}
      <BentoGrid columns={3} gap={6}>
        <BentoItem colSpan={2}>
          <GlassCard padding="lg">
            <GlassCardHeader title={t('skillUsageTrend')} />
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(0,0,0,0.06)',
                      boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                      fontSize: '13px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorUsage)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </BentoItem>

        <BentoItem>
          <GlassCard padding="lg" className="h-full">
            <GlassCardHeader title={t('recentActivity')} />
            <div className="space-y-1 divide-y divide-gray-100 dark:divide-white/5">
              <ActivityItem
                text={t('installedActivity', { name: 'Git Commander' })}
                time={t('minutesAgo', { count: 2 })}
                active
              />
              <ActivityItem
                text={t('updatedActivity', { name: 'Web Search' })}
                time={t('hoursAgo', { count: 2 })}
                active
              />
              <ActivityItem
                text={t('securityScanActivity')}
                time={t('yesterday')}
              />
              <ActivityItem
                text={t('systemUpdateActivity')}
                time={t('daysAgo', { count: 3 })}
              />
            </div>
          </GlassCard>
        </BentoItem>
      </BentoGrid>
    </div>
  );
};

export default Dashboard;
