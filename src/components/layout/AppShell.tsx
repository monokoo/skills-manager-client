import { Outlet } from 'react-router-dom';
import GlassSidebar from './GlassSidebar';

const AppShell = () => {
  return (
    <div className="h-screen w-screen flex overflow-hidden fixed inset-0">
      <GlassSidebar />
      <main className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0F172A] transition-colors duration-200 custom-scrollbar [scrollbar-gutter:stable]">
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
