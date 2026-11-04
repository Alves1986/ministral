import { Announcement, User } from '../types';

const UID_SEPARATOR = '::uid:';

/**
 * Codifica o nome do autor junto com o ID do criador para persistência resiliente
 * na coluna `author_name` mesmo quando a tabela `announcements` não possui coluna `created_by`.
 */
export function encodeAnnouncementAuthor(authorName: string, createdBy?: string | null): string {
  const cleanName = (authorName || 'Admin').split(UID_SEPARATOR)[0].trim() || 'Admin';
  const cleanUid = (createdBy || '').trim();
  if (!cleanUid) return cleanName;
  return `${cleanName}${UID_SEPARATOR}${cleanUid}`;
}

/**
 * Extrai o nome limpo do autor e o ID do criador a partir de `author_name` e `created_by`.
 */
export function parseAnnouncementAuthor(
  rawAuthorName?: string | null,
  rawCreatedBy?: string | null
): { author: string; createdBy?: string } {
  const raw = String(rawAuthorName || '').trim();
  let author = raw || 'Admin';
  let embeddedUid: string | undefined;

  if (raw.includes(UID_SEPARATOR)) {
    const [namePart, uidPart] = raw.split(UID_SEPARATOR);
    author = (namePart || '').trim() || 'Admin';
    if (uidPart && uidPart.trim()) {
      embeddedUid = uidPart.trim();
    }
  }

  const explicitUid = rawCreatedBy && String(rawCreatedBy).trim() ? String(rawCreatedBy).trim() : undefined;
  return {
    author,
    createdBy: explicitUid || embeddedUid,
  };
}

function normalizePersonName(name?: string | null): string {
  if (!name) return '';
  return name
    .split(UID_SEPARATOR)[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Verifica se o usuário atual pode editar o aviso.
 * Regra estrita: APENAS quem criou o aviso pode editá-lo (outros admins não podem).
 */
export function canUserEditAnnouncement(
  announcement?: Pick<Announcement, 'createdBy' | 'authorId' | 'author'> | null,
  currentUser?: Pick<User, 'id' | 'name'> | null
): boolean {
  if (!announcement || !currentUser) return false;

  const parsed = parseAnnouncementAuthor(
    announcement.author,
    announcement.createdBy || announcement.authorId
  );

  const creatorId = parsed.createdBy;
  const currentUserId = (currentUser.id || '').trim();

  // 1. Se houver ID do criador registrado, exige correspondência estrita por ID
  if (creatorId) {
    return Boolean(currentUserId && creatorId === currentUserId);
  }

  // 2. Fallback para avisos legados (salvos apenas com author_name no banco)
  const authorNorm = normalizePersonName(parsed.author);
  const userNorm = normalizePersonName(currentUser.name);

  if (!authorNorm || !userNorm) return false;
  if (authorNorm === 'admin' || authorNorm === 'sistema' || authorNorm === 'usuario') {
    return false;
  }

  return authorNorm === userNorm;
}

