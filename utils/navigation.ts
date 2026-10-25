/**
 * Navigation and Deep Linking Utilities for Ministral
 */

export interface NormalizedTabResult {
  tab: string;
  subTab?: 'editor' | 'events' | 'rules';
  openCreate?: boolean;
}

/**
 * Normalizes any tab string (including legacy bookmarks, notifications and external links)
 * into the unified navigation system.
 */
export function normalizeTabAlias(rawTab?: string | null): NormalizedTabResult {
  if (!rawTab) return { tab: 'dashboard' };
  
  const clean = rawTab.trim();
  
  switch (clean) {
    case 'schedule':
      return { tab: 'calendar' };
      
    case 'repertoire-manager':
      return { tab: 'repertoire' };
      
    case 'send-announcements':
      return { tab: 'announcements', openCreate: true };
      
    case 'event-rules':
      return { tab: 'schedule-editor', subTab: 'events' };
      
    case 'schedule-rules':
      return { tab: 'schedule-editor', subTab: 'rules' };
      
    default:
      return { tab: clean };
  }
}

export interface ScheduleWhatsAppExportData {
  title: string;
  dateDisplay: string;
  time?: string;
  roles: { role: string; member: string }[];
  songs?: { title: string; key?: string; link?: string }[];
}

/**
 * Generates formatted text ready to be sent or copied to WhatsApp
 */
export function formatScheduleForWhatsApp(data: ScheduleWhatsAppExportData): string {
  const timeFormatted = data.time ? ` às ${data.time.substring(0, 5)}` : '';
  
  let lines: string[] = [];
  lines.push(`📅 *${data.title}*`);
  lines.push(`🗓️ ${data.dateDisplay}${timeFormatted}`);
  lines.push('');
  
  lines.push(`👥 *Equipe Escalada:*`);
  if (data.roles && data.roles.length > 0) {
    data.roles.forEach(r => {
      lines.push(`• ${r.role}: ${r.member || 'Vago'}`);
    });
  } else {
    lines.push('• (Nenhum membro escalado)');
  }
  
  if (data.songs && data.songs.length > 0) {
    lines.push('');
    lines.push(`🎵 *Repertório:*`);
    data.songs.forEach((s, idx) => {
      const keyText = s.key ? ` (Tom: ${s.key})` : '';
      lines.push(`${idx + 1}. ${s.title}${keyText}`);
      if (s.link) {
        lines.push(`   🔗 ${s.link}`);
      }
    });
  }
  
  lines.push('');
  lines.push(`_Gerado pelo Ministral_ ✨`);
  
  return lines.join('\n');
}
