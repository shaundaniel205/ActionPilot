import React from 'react';
import { ListTodo, CalendarDays, Layers, Sparkles, TrendingUp, ShieldAlert } from 'lucide-react';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl rounded-[32px] bg-slate-900/70 border border-slate-800 shadow-2xl backdrop-blur-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

interface AppLayoutProps {
  sidebarTab: string;
  onChangeTab: (tab: string) => void;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function AppLayout({ sidebarTab, onChangeTab, children, rightSlot }: AppLayoutProps) {
  const navSections = [
    {
      title: 'APP',
      links: [
        { id: 'dashboard', label: 'Dashboard', icon: ListTodo },
        { id: 'calendar', label: 'Calendar', icon: CalendarDays },
        { id: 'projects', label: 'Projects', icon: Layers },
      ],
    },
    {
      title: 'ANALYSIS',
      links: [
        { id: 'insights', label: 'Insights', icon: TrendingUp },
        { id: 'focus', label: 'Focus Mode', icon: Sparkles },
      ],
    },
    {
      title: 'SYSTEM',
      links: [
        { id: 'settings', label: 'Settings', icon: ShieldAlert },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <aside className="w-80 hidden md:flex flex-col bg-slate-900 border-r border-slate-800 p-6">
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <Sparkles className="w-5 h-5 text-sky-400" />
            <div>
              <p className="text-sm font-bold text-white">ActionPilot</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">AI Companion MVP</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{section.title}</p>
              <div className="space-y-2">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  const active = sidebarTab === link.id;
                  return (
                    <button
                      key={link.id}
                      onClick={() => onChangeTab(link.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-sm font-semibold transition ${
                        active
                          ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 ${active ? 'text-sky-400' : 'text-slate-500'}`} />
                      {link.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-slate-800">
          {rightSlot}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
