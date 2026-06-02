/**
 * Utilitários de formatação de telefone para a Evolution API.
 * Compartilhado entre todas as Edge Functions de WhatsApp.
 */

export function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) {
    return null;
  }
  return "55" + digits;
}

export function phoneFromJid(remoteJid: string): string | null {
  const raw = remoteJid.split("@")[0];
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return formatBrazilPhone(digits);
}
