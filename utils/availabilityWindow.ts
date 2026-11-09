/**
 * A janela é persistida no formato ISO com `Z` para manter o horário digitado
 * como horário de parede (ex.: 18:00 continua sendo 18:00 na interface).
 * Por isso, não usamos `new Date(iso)` diretamente nas regras da janela:
 * isso converteria 18:00Z para 15:00 no horário de Brasília.
 */
export function parseAvailabilityWindowDate(value?: string | null): Date | null {
  if (!value || value.includes('1970')) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0,
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isAvailabilityWindowOpen(
  start?: string | null,
  end?: string | null,
  now = new Date(),
): boolean {
  if ((!start || start.includes('1970')) && (!end || end.includes('1970'))) {
    return !start && !end;
  }

  const startDate = parseAvailabilityWindowDate(start);
  const endDate = parseAvailabilityWindowDate(end);

  return (!startDate || now >= startDate) && (!endDate || now <= endDate);
}
