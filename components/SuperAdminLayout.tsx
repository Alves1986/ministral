import React, { ReactNode, useState } from 'react';
import {
    Shield, LogOut, Sun, Moon, Menu, X, Bell,
    Building2, MessageSquare, Activity, Settings,
    ChevronRight, User as UserIcon
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getSystemLogo } from '../utils/branding';

interface SuperAdminNavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: string;
}

interface Props {
    children: ReactNode;
    currentTab: string;
    onTabChange: (tab: string) => void;
    onLogout: () => void;
}

const SA_NAV_ITEMS: SuperAdminNavItem[] = [
    { id: 'sa-organizations', label: 'Organizações',     icon: <Building2 size={20} /> },
    { id: 'sa-whatsapp',     label: 'WhatsApp Global',   icon: <MessageSquare size={20} /> },
    { id: 'sa-telemetry',    label: 'Telemetria',        icon: <Activity size={20} /> },
];

export const SuperAdminLayout: React.FC<Props> = ({
    children, currentTab, onTabChange, onLogout
}) => {
    const { currentUser, themeMode, setThemeMode } = useAppStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const theme = themeMode === 'dark' ? 'dark' : 'light';
    const logoSrc = getSystemLogo(theme);

    const toggleTheme = () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark');

    const activeItem = SA_NAV_ITEMS.find(i => i.id === currentTab);
    const activeLabel = activeItem?.label ?? 'Super Admin';

    const renderNavButton = (item: SuperAdminNavItem) => {
        const isActive = currentTab === item.id;
        return (
            <button
                key={item.id}
                onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-2xl transition-all duration-300 mb-1
                    ${isActive
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 hover:text-violet-600 dark:hover:text-violet-400'
                    }`}
            >
                <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {item.icon}
                </span>
                <span className="flex-1 text-left tracking-tight">{item.label}</span>
                {item.badge && (
                    <span className="bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {item.badge}
                    </span>
                )}
                {isActive && <ChevronRight size={14} className="opacity-60 flex-shrink-0" />}
            </button>
        );
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-ministral-dark font-sans">

            {/* ── Mobile overlay ─────────────────────────────── */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ─────────────────────────────────────── */}
            <aside className={`
                fixed inset-y-0 left-0 z-[100]
                w-72 lg:w-72 lg:static lg:inset-0
                flex flex-col
                bg-white/90 dark:bg-ministral-dark/90
                backdrop-blur-3xl
                border-r border-slate-200/50 dark:border-slate-800/50
                shadow-2xl lg:shadow-none
                transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>

                {/* Logo + título */}
                <div className="py-8 px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                            <img src={logoSrc} alt="Ministral" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">
                                Ministral
                            </h1>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
                                <Shield size={10} /> Super Admin
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Nav */}
                <div className="flex-1 overflow-y-auto py-2 px-4 custom-scrollbar">
                    <div>
                        <p className="px-3 text-[10px] font-black text-violet-500 tracking-[0.2em] mb-4 uppercase">
                            Gestão Global
                        </p>
                        <div className="space-y-1">
                            {SA_NAV_ITEMS.map(item => renderNavButton(item))}
                        </div>
                    </div>
                </div>

                {/* Rodapé do sidebar */}
                <div className="m-4 p-4 rounded-[2rem] border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur-md">
                    <div className="flex items-center gap-3 p-2 rounded-2xl mb-3">
                        <div className="w-10 h-10 flex-shrink-0 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-sm border-2 border-white dark:border-ministral-dark shadow-md">
                            {currentUser?.name?.charAt(0)?.toUpperCase() ?? 'S'}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">
                                {currentUser?.name?.split(' ')[0] ?? 'Super Admin'}
                            </p>
                            <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold flex items-center gap-1">
                                <Shield size={9} /> Administrador Global
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={onLogout}
                            className="flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors"
                        >
                            <LogOut size={14} /> Sair
                        </button>
                        <button
                            onClick={toggleTheme}
                            className="flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-500/10 hover:bg-slate-500/20 rounded-xl transition-colors"
                        >
                            {themeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Modo
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────── */}
            <main className="flex-1 flex flex-col min-w-0 max-w-full bg-transparent overflow-hidden relative">

                {/* Header mobile */}
                <header className="lg:hidden h-16 px-4 flex items-center justify-between sticky top-0 z-30 bg-white/70 dark:bg-ministral-dark/70 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-violet-600" />
                            <span className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-tighter">
                                {activeLabel}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-xs">
                            {currentUser?.name?.charAt(0)?.toUpperCase() ?? 'S'}
                        </div>
                    </div>
                </header>

                {/* Header desktop */}
                <header className="hidden lg:flex h-20 px-10 items-center justify-between sticky top-0 z-30 bg-slate-50/50 dark:bg-ministral-dark/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className="text-violet-600 p-2.5 bg-violet-50 dark:bg-violet-900/20 rounded-2xl shadow-sm border border-violet-200 dark:border-violet-900/40">
                            <Shield size={20} />
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                        <div>
                            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none">
                                {activeLabel}
                            </h2>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                Painel de Administração Global
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md"
                        >
                            {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-xl border border-rose-200 dark:border-rose-900/40 transition-colors"
                        >
                            <LogOut size={16} /> Sair
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
};
