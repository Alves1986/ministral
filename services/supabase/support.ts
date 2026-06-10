import { getSupabase } from './client';

export interface SupportTicket {
  id: string;
  orgId: string;
  orgName: string;
  authorId: string;
  authorName: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: string;
  replies: {
      id: string;
      authorName: string;
      isSuperAdmin: boolean;
      content: string;
      createdAt: string;
  }[];
}

const getLocalTickets = (): SupportTicket[] => {
    try {
        return JSON.parse(localStorage.getItem('ministral_support_tickets') || '[]');
    } catch {
        return [];
    }
};

const saveLocalTickets = (tickets: SupportTicket[]) => {
    localStorage.setItem('ministral_support_tickets', JSON.stringify(tickets));
};

export const fetchSupportTickets = async () => {
    // Para protótipo e evitar problemas de RLS de SuperAdmin em notifications
    return getLocalTickets();
};

export const createSupportTicket = async (orgId: string, orgName: string, authorId: string, authorName: string, subject: string, description: string, priority: string) => {
    const all = getLocalTickets();
    const newTicket: SupportTicket = {
        id: 'TKT-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        orgId,
        orgName,
        authorId,
        authorName,
        subject,
        description,
        status: 'open',
        priority: priority as any,
        createdAt: new Date().toISOString(),
        replies: []
    };
    all.push(newTicket);
    saveLocalTickets(all);
    return newTicket;
};

export const updateSupportTicket = async (id: string, updates: Partial<SupportTicket>) => {
    const all = getLocalTickets();
    const index = all.findIndex(t => t.id === id);
    if (index !== -1) {
        all[index] = { ...all[index], ...updates };
        saveLocalTickets(all);
        return true;
    }
    return false;
};

export const deleteSupportTicket = async (id: string) => {
    const all = getLocalTickets();
    const filtered = all.filter(t => t.id !== id);
    saveLocalTickets(filtered);
    return true;
};

