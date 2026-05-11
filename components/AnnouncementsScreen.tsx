import React from 'react';
import { Announcement, User } from '../types';
import { AnnouncementCard } from './AnnouncementCard';
import { Megaphone, RefreshCw } from 'lucide-react';

interface Props {
  announcements: Announcement[];
  currentUser: User;
  onMarkRead: (id: string) => void;
  onToggleLike: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onRefresh: () => void;
}

export const AnnouncementsScreen: React.FC<Props> = ({ announcements, currentUser, onMarkRead, onToggleLike, onTogglePin, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                <Megaphone className="text-ministral-500"/> Central de Avisos
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
                Fique por dentro de tudo o que acontece no ministério.
            </p>
        </div>
        <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-zinc-400 hover:text-ministral-500 hover:bg-ministral-50 dark:hover:bg-ministral-900/20 rounded-lg transition-all disabled:opacity-50"
            title="Atualizar Avisos"
        >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
            <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed">
                <Megaphone className="mx-auto mb-3 opacity-20" size={48}/>
                <p className="text-zinc-500">Nenhum aviso ativo no momento.</p>
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