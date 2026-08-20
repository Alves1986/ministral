import { getSupabase } from './client';

export interface SupportTicket {
  id: string;
  orgId: string;
  orgName: string;
  authorId: string;
  authorName: string;
  subject: string;
  description: string;
  imageUrl?: string;
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

export interface SupportAccessScope {
    organizationId?: string;
    isSuperAdmin?: boolean;
}

const hasSupportScope = (scope?: SupportAccessScope) =>
    Boolean(scope?.isSuperAdmin || scope?.organizationId);

export const fetchSupportTickets = async (scope?: SupportAccessScope): Promise<SupportTicket[]> => {
    const sb = getSupabase();
    if (!sb || !hasSupportScope(scope)) return [];
    
    let query = sb.from('support_tickets')
        .select(`
            *,
            organizations (
                name
            )
        `)
        .order('created_at', { ascending: false });

    if (!scope?.isSuperAdmin) {
        query = query.eq('organization_id', scope?.organizationId);
    }

    const { data, error } = await query;
        
    if (error || !data) return [];
    
    return data.map((t: any) => ({
        id: t.id,
        orgId: t.organization_id,
        orgName: t.organizations?.name || 'Organização',
        authorId: t.author_id,
        authorName: t.author_name,
        subject: t.subject,
        description: t.description,
        imageUrl: t.image_url,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        replies: t.replies || []
    }));
};

export const createSupportTicket = async (orgId: string, orgName: string, authorId: string | undefined | null, authorName: string, subject: string, description: string, priority: string, imageUrl?: string) => {
    const sb = getSupabase();
    if (!sb) return null;

    const payload: any = {
        organization_id: orgId,
        author_name: authorName,
        subject,
        description,
        status: 'open',
        priority,
        replies: []
    };
    
    if (imageUrl) {
        payload.image_url = imageUrl;
    }
    
    // Evita enviar authorId como string vazia ou undef, o que quebra o tipo UUID no banco
    if (authorId && authorId.trim() !== '') {
        payload.author_id = authorId;
    }

    const { data, error } = await sb.from('support_tickets').insert(payload).select(`*, organizations(name)`).single();

    if (error) {
        console.error("Error creating ticket:", error);
        return null;
    }

    return {
        id: data.id,
        orgId: data.organization_id,
        orgName: data.organizations?.name || orgName,
        authorId: data.author_id,
        authorName: data.author_name,
        subject: data.subject,
        description: data.description,
        imageUrl: data.image_url,
        status: data.status,
        priority: data.priority,
        createdAt: data.created_at,
        replies: data.replies || []
    };
};

export const updateSupportTicket = async (id: string, updates: Partial<SupportTicket>, scope?: SupportAccessScope) => {
    const sb = getSupabase();
    if (!sb || !hasSupportScope(scope)) return false;
    
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.priority) dbUpdates.priority = updates.priority;
    if (updates.replies) dbUpdates.replies = updates.replies;

    let query = sb.from('support_tickets').update(dbUpdates).eq('id', id);
    if (!scope?.isSuperAdmin) {
        query = query.eq('organization_id', scope?.organizationId);
    }
    const { error } = await query;
    return !error;
};

export const deleteSupportTicket = async (id: string, scope?: SupportAccessScope) => {
    const sb = getSupabase();
    if (!sb || !hasSupportScope(scope)) return false;
    
    let query = sb.from('support_tickets').delete().eq('id', id);
    if (!scope?.isSuperAdmin) {
        query = query.eq('organization_id', scope?.organizationId);
    }
    const { error } = await query;
    return !error;
};

export const uploadTicketImage = async (file: File): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    
    try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `tickets/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
        
        const { error: uploadError } = await sb.storage.from('avatars').upload(fileName, file);
        if (uploadError) {
            console.error(uploadError);
            return null;
        }
        
        const { data } = sb.storage.from('avatars').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) {
        return null;
    }
};
