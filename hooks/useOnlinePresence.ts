
import { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../services/supabase/client';

export function useOnlinePresence(userId?: string, userName?: string, onStatusChange?: (name: string, status: 'online' | 'offline') => void) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const channelRef = useRef<any | null>(null);
  
  // Use a short delay before enabling notifications to skip the initial sync burst
  const isSyncing = useRef(true);

  useEffect(() => {
    if (!userId || !userName) return;

    const supabase = getSupabase();
    if (!supabase) return;

    if (channelRef.current) return;

    // Reset sync flag
    isSyncing.current = true;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const onlineIds = Object.keys(newState);
        setOnlineUsers(onlineIds);
        
        // After initial sync, allow notifications
        setTimeout(() => {
            isSyncing.current = false;
        }, 1500);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (isSyncing.current) return;

        if (onStatusChange) {
          newPresences.forEach((p: any) => {
            if (p.user_id !== userId && p.name) {
              onStatusChange(p.name, 'online');
            }
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (onStatusChange) {
          leftPresences.forEach((p: any) => {
            if (p.user_id !== userId && p.name) {
              onStatusChange(p.name, 'offline');
            }
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: userId,
            name: userName,
          });
        }
      });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [userId, userName]); 

  return onlineUsers;
}
