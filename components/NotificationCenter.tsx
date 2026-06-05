
import React, { useState, useRef } from 'react';
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle, AlertOctagon, ExternalLink, ArrowRightLeft, X } from 'lucide-react';
import { AppNotification } from '../types';
import { markNotificationsReadSQL, clearAllNotificationsSQL, clearNotificationsSQL } from '../services/supabaseService';
import { getSupabase } from '../services/supabase/client';
import { useToast } from './Toast';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAppStore } from '../store/appStore';

interface Props {
  notifications: AppNotification[];
  ministryId: string | null;
  onNotificationsUpdate: (updated: AppNotification[], shouldRefresh?: boolean) => void;
  onNavigate?: (tabId: string) => void;
  onSwitchMinistry?: (ministryId: string) => void;
}

export const NotificationCenter: React.FC<Props> = ({ notifications, ministryId, onNotificationsUpdate, onNavigate, onSwitchMinistry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const { confirmAction } = useToast();
  const { currentUser } = useAppStore();
  
  // FIX: ERRO 1 - Strict organizationId check
  const orgId = currentUser?.organizationId;

  useClickOutside(dropdownRef, () => {
    if (isOpen) setIsOpen(false);
  });

  // Verifica se é admin para liberar o botão de deletar
  React.useEffect(() => {
      // @ts-ignore
      (getSupabase()?.auth as any).getUser().then(({ data: { user } }: any) => {
          if (user) {
             getSupabase()?.from('profiles').select('is_admin').eq('id', user.id).single()
                .then(({ data }) => setIsAdmin(!!data?.is_admin));
          }
      });
  }, []);

  const handleMarkAllRead = async () => {
    const supabase = getSupabase();
    if (!supabase || !orgId) return; // Strict check
    
    // @ts-ignore
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (!user) return;

    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0 || !currentUser?.id) return;
    
    // Optimistic update
    const updated = notifications.map(n => ({...n, read: true}));
    onNotificationsUpdate(updated, false); // Don't refresh yet
    
    await markNotificationsReadSQL(unreadIds, currentUser.id, orgId);
  };

  const handleClearAll = async () => {
      if (!orgId) return;
      
      confirmAction(
          "Limpar Notificações",
          "Deseja ocultar todas as suas notificações? Isso não afetará os outros membros.",
          async () => {
              if (!currentUser?.id) return;
              
              const idsToClear = notifications.map(n => n.id);
              
              // Optimistic update
              onNotificationsUpdate([], false);
              
              await clearNotificationsSQL(idsToClear, currentUser.id, orgId);
          }
      );
  };

  const handleClearSingle = async (e: React.MouseEvent, notification: AppNotification) => {
      e.stopPropagation(); // Prevent opening the link
      if (!orgId || !currentUser?.id) return;
      
      // Optimistic update
      const updated = notifications.filter(n => n.id !== notification.id);
      onNotificationsUpdate(updated, false);
      
      await clearNotificationsSQL([notification.id], currentUser.id, orgId);
  };

  const handleNotificationClick = async (notification: AppNotification) => {
      if (!notification.read && orgId && currentUser?.id) {
          // Optimistic update
          const updated = notifications.map(n => n.id === notification.id ? { ...n, read: true } : n);
          onNotificationsUpdate(updated, false);
          
          await markNotificationsReadSQL([notification.id], currentUser.id, orgId);
      }

      // Logic: 
      // 1. If notification is from another ministry, switch ministry first.
      // 2. Then navigate to the link if present.
      
      const isDifferentMinistry = notification.ministryId && notification.ministryId !== ministryId;

      if (isDifferentMinistry && onSwitchMinistry && notification.ministryId) {
          onSwitchMinistry(notification.ministryId);
      } 
      
      if (notification.actionLink && onNavigate && !isDifferentMinistry) {
          onNavigate(notification.actionLink);
      }
      
      setIsOpen(false);
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'success': return <CheckCircle size={16} className="text-secondary dark:text-white"/>;
          case 'warning': return <AlertTriangle size={16} className="text-amber-500"/>;
          case 'alert': return <AlertOctagon size={16} className="text-red-500"/>;
          default: return <Info size={16} className="text-blue-500"/>;
      }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-colors ${isOpen ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
      >
        <Bell size={20} className="text-zinc-600 dark:text-zinc-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-pulse border border-white dark:border-zinc-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden animate-slide-up">
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Notificações</h3>
                <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[10px] text-secondary dark:text-white hover:text-secondaryHover font-bold flex items-center gap-1" title="Marcar todas como lidas">
                        <Check size={12}/> Ler
                    </button>
                )}
                {notifications.length > 0 && (
                    <button onClick={handleClearAll} className="text-[10px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1" title="Limpar minhas notificações">
                        <Trash2 size={12}/> Limpar
                    </button>
                )}
                </div>
            </div>
            
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 text-sm">
                        <Bell size={24} className="mx-auto mb-2 opacity-20"/>
                        Nenhuma notificação.
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                        {notifications.map(n => {
                            const isDifferent = n.ministryId && n.ministryId !== ministryId;
                            return (
                                <div 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)}
                                className={`p-4 transition-colors relative group cursor-pointer ${!n.read ? 'bg-secondary/10 dark:bg-secondary/5' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/30'}`}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                            <h4 className={`text-sm ${!n.read ? 'font-bold text-zinc-800 dark:text-zinc-100' : 'font-medium text-zinc-600 dark:text-zinc-400'}`}>
                                                {n.title}
                                            </h4>
                                            <div className="flex items-center gap-2 ml-2">
                                                {isDifferent ? (
                                                    <span className="text-[9px] uppercase font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <ArrowRightLeft size={8} /> {n.ministryName || n.ministryId?.slice(0, 8).toUpperCase()}
                                                    </span>
                                                ) : n.actionLink && (
                                                    <ExternalLink size={12} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )}
                                                <button 
                                                    onClick={(e) => handleClearSingle(e, n)}
                                                    className="p-1 text-zinc-400 hover:text-red-500 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Limpar notificação"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                                {n.message}
                                            </p>
                                            <span className="text-[10px] text-zinc-400 mt-2 block">
                                                {new Date(n.timestamp).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
