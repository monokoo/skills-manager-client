import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import GlassSidebar from './GlassSidebar';
import { useSkillStore } from '../../store/useSkillStore';

const AppShell = () => {
  const { fetchCustomSources, fetchCustomMarketplace, refreshCustomSource } = useSkillStore();

  useEffect(() => {
    // T1.6: 启动时静默加载自定义源并检查更新
    fetchCustomSources();
    fetchCustomMarketplace();
    refreshCustomSource(); // 后台检查全部源的更新
  }, []);

  return (
    <div className="h-screen w-screen flex overflow-hidden fixed inset-0">
      <GlassSidebar />
      <main id="main-content" className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0F172A] transition-colors duration-200 custom-scrollbar [scrollbar-gutter:stable]">
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
