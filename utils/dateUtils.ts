
import { CustomEvent } from '../types';

// Retorna a data atual no formato YYYY-MM-DD respeitando o fuso horário local do navegador.
// Corrige o bug onde new Date().toISOString() retornava o dia seguinte após as 21h (UTC-3).
export const getLocalDateISOString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMonthName = (monthIso: string) => {
  if (!monthIso) return "";
  const [y, m] = monthIso.split("-").map(Number);
  // Usa o dia 15 para evitar que fusos horários voltem o mês para o anterior no dia 1
  const date = new Date(y, m - 1, 15);
  const name = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const adjustMonth = (currentMonth: string, delta: number): string => {
  const [y, m] = currentMonth.split('-').map(Number);
  // Usa o dia 15 para evitar problemas de virada de mês/fuso
  const date = new Date(y, m - 1 + delta, 15);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
};

export const generateMonthEvents = (year: number, month: number, customEvents: CustomEvent[]) => {
  const events: { iso: string; dateDisplay: string; title: string }[] = [];
  
  // Formata o mês alvo YYYY-MM para filtrar eventos
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  if (customEvents && customEvents.length > 0) {
      customEvents.forEach(evt => {
        // Garante que a data existe e pertence ao mês atual
        // Comparação estrita de string para evitar conversão de data e shifts de timezone
        if (evt.date && evt.date.startsWith(monthStr)) {
           const parts = evt.date.split('-');
           // parts[0] = Year, parts[1] = Month, parts[2] = Day
           if (parts.length === 3) {
               const day = parts[2];
               const monthPart = parts[1];
               // Monta DD/MM diretamente da string do banco, ignorando timezone
               const dateDisplay = `${day}/${monthPart}`;
               const iso = `${evt.date}T${evt.time}`;
               events.push({ iso, dateDisplay, title: evt.title });
           }
        }
      });
  }

  // Ordena por string ISO, que funciona cronologicamente de forma consistente
  return events.sort((a, b) => a.iso.localeCompare(b.iso));
};

export const generateGoogleCalendarUrl = (title: string, isoDateTime: string, description: string = ""): string => {
    // Input: "2023-10-25T19:30"
    try {
        const dateObj = new Date(isoDateTime);
        const endDateObj = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000); // +2 horas de duração padrão

        // Formata para YYYYMMDDTHHmmss (Sem Z para usar horário local do usuário/agenda)
        const format = (d: Date) => {
            return d.getFullYear().toString() +
            (d.getMonth() + 1).toString().padStart(2, '0') +
            d.getDate().toString().padStart(2, '0') +
            'T' +
            d.getHours().toString().padStart(2, '0') +
            d.getMinutes().toString().padStart(2, '0') +
            '00';
        };

        const start = format(dateObj);
        const end = format(endDateObj);

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${start}/${end}`,
            details: description,
        });

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    } catch (e) {
        console.error("Erro ao gerar link do calendário", e);
        return "#";
    }
};
