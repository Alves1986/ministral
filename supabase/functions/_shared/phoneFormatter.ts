/**
 * Formata um número de telefone para o padrão exigido pela Evolution API.
 * Retorna null se o número for inválido após limpeza.
 * 
 * Padrão de saída: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
 * Exemplos válidos: "5511999998888", "5511988887777"
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
