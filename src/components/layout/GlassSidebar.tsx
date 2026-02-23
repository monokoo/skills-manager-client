import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Library, ShoppingBag, Settings, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const NAV_ITEMS = [
  // { path: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard }, // temporarily disabled
  { path: '/my-skills', labelKey: 'mySkills', icon: Library },
  { path: '/marketplace', labelKey: 'marketplace', icon: ShoppingBag },
  { path: '/settings', labelKey: 'settings', icon: Settings },
  { path: '/security', labelKey: 'security', icon: Shield },
];

function GlassSidebar() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) return saved;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  const toggleLanguage = () => i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');

  return (
    <aside className="
      w-[220px] flex-none h-screen flex flex-col
      bg-white/60 dark:bg-white/5
      backdrop-blur-xl
      border-r border-black/5 dark:border-white/10
      transition-colors duration-200
    ">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3" data-tauri-drag-region>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
          S
        </div>
        <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
          Skill Manager
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${active
                  ? 'bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              <item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div className="px-3 pb-4 space-y-2">
        {/* Theme & Language */}
        <div className="flex items-center gap-2 px-2">
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
              bg-black/5 dark:bg-white/5
              hover:bg-black/10 dark:hover:bg-white/10
              text-gray-600 dark:text-gray-400
              transition-colors text-xs font-medium"
            title={t('theme')}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button
            onClick={toggleLanguage}
            className="flex-1 flex items-center justify-center py-2 rounded-lg
              bg-black/5 dark:bg-white/5
              hover:bg-black/10 dark:hover:bg-white/10
              text-gray-600 dark:text-gray-400
              transition-colors text-xs font-bold"
            title={t('language')}
          >
            {i18n.language === 'zh' ? 'EN' : '中文'}
          </button>
        </div>

        {/* Version */}
        <div className="px-3 py-1 text-[11px] text-gray-400 dark:text-gray-600">
          v{__APP_VERSION__}
        </div>
      </div>
    </aside>
  );
}

export default GlassSidebar;
