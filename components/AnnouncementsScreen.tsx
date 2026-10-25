import React, { useState, useEffect } from 'react';
import { Announcement, User } from '../types';
import { AnnouncementCard } from './AnnouncementCard';
import { Megaphone, RefreshCw, Plus, X, Send } from 'lucide-react';
import { AlertsManager } from './AlertsManager';

interface Props {
  announcements: Announcement[];
  currentUser: User;
  onMarkRead: (id: string) => void;
  onToggleLike: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onRefresh: () => void;
  canCreate?: boolean;
  orgName?: string;
  ministryName?: string;
  members?: any[];
  roles?: string[];
  onSendAnnouncement?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert', expirationDate: string, externalLink?: string) => Promise<void>;
  initialOpenCreate?: boolean;
  onCloseCreate?: () => void;
}

export const AnnouncementsScreen: React.FC<Props> = ({ 
  announcements, 
  currentUser, 
  onMarkRead, 
  onToggleLike, 
  onTogglePin, 
  onRefresh,
  canCreate = false,
  orgName = '',
  ministryName = '',
  members = [],
  roles = [],
  onSendAnnouncement,
  initialOpenCreate = false,
  onCloseCreate
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(initialOpenCreate);

  useEffect(() => {
    if (initialOpenCreate) {
      setIsCreateModalOpen(true);
    }
  }, [initialOpenCreate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    if (onCloseCreate) onCloseCreate();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <Megaphone className="text-ministral-500"/> Central de Avisos
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Fique por dentro de tudo o que acontece no ministério.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {canCreate && onSendAnnouncement && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-ministral-500 hover:bg-ministral-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-ministral-500/20 active:scale-95 transition-all"
            >
              <Plus size={16} /> Novo Comunicado
            </button>
          )}

          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-zinc-400 hover:text-ministral-500 hover:bg-ministral-50 dark:hover:bg-ministral-900/20 rounded-xl transition-all disabled:opacity-50"
            title="Atualizar Avisos"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Modal / Diálogo de Novo Comunicado para Líderes */}
      {isCreateModalOpen && canCreate && onSendAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto custom-scrollbar p-6 relative shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                <Send size={18} className="text-ministral-500" /> Publicar Novo Comunicado
              </h3>
              <button 
                onClick={handleCloseModal} 
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <AlertsManager
              orgName={orgName}
              ministryName={ministryName}
              members={members}
              roles={roles}
              onSend={async (title, message, type, expDate, extLink) => {
                await onSendAnnouncement(title, message, type, expDate, extLink);
                handleCloseModal();
                await onRefresh();
              }}
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
            <Megaphone className="mx-auto mb-3 opacity-20 text-zinc-500" size={48}/>
            <p className="text-zinc-500 font-medium">Nenhum aviso ativo no momento.</p>
          </div>
        ) : (
          [...announcements]
            .sort((a, b) => {
              if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
              }
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            })
            .map(announcement => (
              <AnnouncementCard 
                key={announcement.id} 
                announcement={announcement} 
                currentUser={currentUser}
                onMarkRead={onMarkRead}
                onToggleLike={onToggleLike}
                onTogglePin={onTogglePin}
              />
            ))
        )}
      </div>
    </div>
  );
};
