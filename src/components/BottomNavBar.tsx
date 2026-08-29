import React from 'react';
import { Map, Layers, CloudOff, FileText, Settings } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  territoriesCount: number;
  notesCount: number;
  offlinePackagesCount: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  territoriesCount,
  notesCount,
  offlinePackagesCount
}) => {
  const navItems = [
    {
      id: 'map' as ActiveTab,
      label: 'Mapa',
      icon: Map,
      badge: null
    },
    {
      id: 'territories' as ActiveTab,
      label: 'Territorios',
      icon: Layers,
      badge: territoriesCount > 0 ? territoriesCount : null
    },
    {
      id: 'offline' as ActiveTab,
      label: 'Offline',
      icon: CloudOff,
      badge: offlinePackagesCount > 0 ? offlinePackagesCount : null
    },
    {
      id: 'notes' as ActiveTab,
      label: 'Notas',
      icon: FileText,
      badge: notesCount > 0 ? notesCount : null
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Configuración',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <nav className="min-h-[3.75rem] h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-1 sm:px-2 select-none z-40 shrink-0 shadow-2xl pb-[env(safe-area-inset-bottom,0px)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            id={`nav-tab-${item.id}`}
            onClick={() => onTabChange(item.id)}
            className={`relative flex flex-col items-center justify-center flex-1 py-1 px-2 h-full transition-all duration-150 rounded-lg ${
              isActive
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {/* Active Pill Indicator */}
            {isActive && (
              <span className="absolute top-1.5 w-10 h-1 bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/50" />
            )}

            <div className="relative mt-1">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              {item.badge !== null && (
                <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-slate-950 text-[10px] font-black font-mono w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>

            <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
