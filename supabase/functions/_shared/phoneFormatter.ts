/**
 * Utilitários de formatação de telefone para a Evolution API.
 * Compartilhado entre todas as Edge Functions de WhatsApp.
 *
 * Padrão de saída: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
 * Exemplos válidos: "5511999998888", "5511988887777"
 */

/**
 * Formata um número bruto (qualquer formato) para o padrão 55XXXXXXXXXXX.
 * Retorna null se o número for inválido.
 */
export function formatBrazilPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Remove tudo que não é dígito
  let digits = raw.replace(/\D/g, '');

  // Remove o código de país se já vier com 55
  if (digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  // Espera DDD (2) + número (8 ou 9 dígitos) = 10 ou 11 dígitos
  if (digits.length < 10 || digits.length > 11) {
    return null; // Número inválido
  }

  return '55' + digits;
}

/**
 * Extrai e normaliza o número do remoteJid da Evolution API.
 * Exemplos de entrada: "5511999998888@s.whatsapp.net"
 */
export function phoneFromJid(remoteJid: string): string | null {
  const raw = remoteJid.split('@')[0];
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  // Se já começa com 55 e tem 12-13 dígitos → mantém
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  // Senão, adiciona DDI
  return formatBrazilPhone(digits);
}
