import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="h-screen flex flex-col bg-[#FAFBFC] dark:bg-base-300 transition-colors duration-200 overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto pt-6 custom-scrollbar">
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-10">
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
