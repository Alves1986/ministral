
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ScheduleMap, Role } from "../types";
import { getMonthName } from "./dateUtils";

// --- Design Constants ---
const COLORS = {
  PRIMARY: [30, 58, 95],    // #1E3A5F
  SECONDARY: [42, 78, 122],  // #2A4E7A
  ACCENT: [248, 250, 252],    // #F8FAFC
  TEXT_DARK: [11, 18, 32],    // #0B1220
  TEXT_LIGHT: [107, 114, 128],// #6B7280
  TABLE_LINE: [229, 231, 235],// #E5E7EB
  WHITE: [255, 255, 255],
  GOLD: [214, 178, 94]      // #D6B25E
};

const LOGO_URL = "/branding/logo-light.png"; // Usando o ícone do app

// Helper para desenhar cabeçalho padrão
const drawHeader = (doc: jsPDF, title: string, subtitle: string, logoUrl?: string | null, orientation: 'p' | 'l' = 'l') => {
  const pageWidth = doc.internal.pageSize.width;
  const finalLogo = logoUrl || LOGO_URL;
  const isLandscape = orientation === 'l';
  
  let currentY = isLandscape ? 7 : 10;
  let textStartX = isLandscape ? 10 : 14;

  // Logo da Organização ou Sistema na ESQUERDA
  if (finalLogo) {
    try {
      const logoSize = isLandscape ? 10 : 12;
      doc.addImage(finalLogo, 'PNG', textStartX, currentY, logoSize, logoSize, undefined, 'FAST');
      textStartX = textStartX + logoSize + 4;
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn("Could not add logo to PDF:", e);
      }
    }
  }

  // Título Principal (Ao lado da logo)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(isLandscape ? 13 : 16);
  doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
  doc.text(title.toUpperCase(), textStartX, currentY + (isLandscape ? 4.5 : 6));

  // Subtítulo (Mês/Ano) - Abaixo do título
  doc.setFont("helvetica", "normal");
  doc.setFontSize(isLandscape ? 8.5 : 10);
  doc.setTextColor(COLORS.TEXT_LIGHT[0], COLORS.TEXT_LIGHT[1], COLORS.TEXT_LIGHT[2]);
  doc.text(subtitle, textStartX, currentY + (isLandscape ? 9 : 11));

  currentY += isLandscape ? 12 : 18;

  // Data de Geração discreta
  doc.setFontSize(isLandscape ? 6.5 : 7);
  const dateStr = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
  doc.text(dateStr, pageWidth - (isLandscape ? 10 : 14), currentY - (isLandscape ? 3 : 4), { align: "right" });
  
  // Linha separadora
  doc.setDrawColor(COLORS.TABLE_LINE[0], COLORS.TABLE_LINE[1], COLORS.TABLE_LINE[2]);
  doc.line(isLandscape ? 8 : 14, currentY - 1, pageWidth - (isLandscape ? 8 : 14), currentY - 1);
  
  return currentY + (isLandscape ? 3 : 5); // Retorna a posição Y onde a tabela deve começar
};

// Helper para rodapé
const drawFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(150);
      
      // Esquerda
      doc.text("Ministral - Excelência na escala. Propósito no servir.", 10, pageHeight - 6);
      
      // Direita (Paginação)
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 10, pageHeight - 6, { align: "right" });
  }
};

export const generateFullSchedulePDF = (
  ministryName: string,
  monthIso: string,
  events: { id: string; iso: string; title: string; dateDisplay: string }[],
  roles: Role[],
  schedule: ScheduleMap,
  logoUrl?: string | null,
  autoSave: boolean = true
): jsPDF => {
  const monthName = getMonthName(monthIso);

  // Preparar Colunas
  const columns = [
    { header: "DATA", dataKey: "date" },
    { header: "HORA", dataKey: "time" },
    { header: "EVENTO", dataKey: "event" },
    ...roles.map(r => ({ header: r.toUpperCase(), dataKey: r }))
  ];

  // Preparar Dados (com sanitização estrita para Coral)
  const body = events.map(evt => {
    const time = evt.iso.split('T')[1].substring(0, 5); // HH:mm
    
    // Detectar dia da semana
    const dateObj = new Date(evt.iso);
    const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
    
    const row: any = {
      date: `${evt.dateDisplay} (${weekDay.replace('.', '')})`,
      time: time,
      event: evt.title
    };

    roles.forEach(role => {
      const key = `${evt.id}|${role}`;
      let value = schedule[key];
      
      // Onde tem coral, exporta somente como "Coral"
      if (typeof value === 'string' && value.trim().toLowerCase().startsWith('coral')) {
        value = 'Coral';
      }
      
      row[role] = value || "";
    });

    return row;
  });

  // Função interna para renderizar tabela com ajuste de escala
  const renderDoc = (scale: number = 1.0) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const startY = drawHeader(doc, ministryName, `Escala Oficial - ${monthName}`, logoUrl, 'l');

    const rowCount = Math.max(body.length + 1, 1);

    // Dimensionamento responsivo de fonte para garantir exatamente 1 página
    let baseFontSize = 7.2;
    if (columns.length > 10) baseFontSize = 6.8;
    if (columns.length > 14) baseFontSize = 6.2;
    if (columns.length > 18) baseFontSize = 5.5;

    if (rowCount > 14) baseFontSize = Math.min(baseFontSize, 6.2);
    if (rowCount > 18) baseFontSize = Math.min(baseFontSize, 5.6);
    if (rowCount > 24) baseFontSize = Math.min(baseFontSize, 5.0);

    const fontSize = Math.max(4.5, Number((baseFontSize * scale).toFixed(2)));

    // Dimensionamento do padding vertical para compactação de linhas
    let vPad = 1.3;
    if (rowCount > 10) vPad = 1.0;
    if (rowCount > 15) vPad = 0.75;
    if (rowCount > 20) vPad = 0.55;
    if (rowCount > 26) vPad = 0.4;
    vPad = Math.max(0.3, Number((vPad * scale).toFixed(2)));

    const hPad = Math.max(0.4, Number((0.8 * scale).toFixed(2)));

    // @ts-ignore
    autoTable(doc, {
      columns: columns,
      body: body,
      startY: startY,
      theme: 'grid',
      margin: { left: 8, right: 8, bottom: 8, top: startY },
      pageBreak: 'avoid',
      rowPageBreak: 'avoid',
      styles: {
        fontSize: fontSize,
        cellPadding: { top: vPad, bottom: vPad, left: hPad, right: hPad },
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
      },
      headStyles: {
        fillColor: COLORS.WHITE as [number, number, number],
        textColor: COLORS.SECONDARY as [number, number, number],
        fontStyle: 'bold',
        lineWidth: 0,
        valign: 'middle',
      },
      bodyStyles: {
        fillColor: COLORS.WHITE as [number, number, number],
        textColor: COLORS.TEXT_DARK as [number, number, number],
        lineColor: COLORS.TABLE_LINE as [number, number, number],
        lineWidth: 0.1,
      },
      columnStyles: {
        date: { fontStyle: 'bold', cellWidth: 'auto', textColor: COLORS.SECONDARY as [number, number, number] },
        time: { halign: 'center', cellWidth: 'auto' },
        event: { fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250] as [number, number, number]
      },
      didParseCell: function(data: any) {
        if (data.section === 'head') {
          data.cell.styles.lineWidth = 0; 
        }
        if (data.section === 'body' && !data.cell.raw) {
          data.cell.text = ["-"];
          data.cell.styles.textColor = [200, 200, 200];
          data.cell.styles.halign = 'center';
        }
      },
      willDrawCell: function(data: any) {
        if (data.row.index === -1 && data.section === 'head') {
          doc.setDrawColor(COLORS.PRIMARY[0], COLORS.PRIMARY[1], COLORS.PRIMARY[2]);
          doc.setLineWidth(0.5);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      }
    });

    return doc;
  };

  // Garante que o documento ocupe estritamente 1 única página
  let doc = renderDoc(1.0);
  if (doc.getNumberOfPages() > 1) {
    doc = renderDoc(0.88);
  }
  if (doc.getNumberOfPages() > 1) {
    doc = renderDoc(0.78);
  }

  // Remove qualquer página sobressalente residual
  while (doc.getNumberOfPages() > 1) {
    doc.deletePage(doc.getNumberOfPages());
  }

  drawFooter(doc);

  if (autoSave && typeof doc.save === 'function') {
    doc.save(`Escala_${ministryName.trim()}_${monthIso}.pdf`);
  }

  return doc;
};

export const generateIndividualPDF = (
  ministryName: string,
  monthIso: string,
  memberName: string,
  events: { id: string; iso: string; title: string; dateDisplay: string }[],
  schedule: ScheduleMap,
  logoUrl?: string | null
) => {
  // Portrait para individual
  const doc = new jsPDF();
  const monthName = getMonthName(monthIso);

  const startY = drawHeader(doc, ministryName, `Ficha Individual - ${monthName}`, logoUrl, 'p');

  // Info do Membro (Card style)
  doc.setFillColor(248, 250, 252); // Zinc-50
  doc.roundedRect(14, startY, 182, 20, 2, 2, "F");
  
  doc.setFontSize(9);
  doc.setTextColor(COLORS.TEXT_LIGHT[0], COLORS.TEXT_LIGHT[1], COLORS.TEXT_LIGHT[2]);
  doc.text("MEMBRO", 20, startY + 7);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
  doc.text(memberName, 20, startY + 14);

  // Filtrar eventos do membro
  const myEvents: any[] = [];
  events.forEach(evt => {
      Object.entries(schedule).forEach(([key, assignedName]) => {
          if (evt.id && key.startsWith(`${evt.id}|`) && assignedName === memberName) {
              const role = key.split('|').slice(2).join('|'); 
              myEvents.push({
                  date: evt.dateDisplay,
                  weekday: new Date(evt.iso).toLocaleDateString('pt-BR', { weekday: 'long' }),
                  time: evt.iso.split('T')[1].substring(0, 5),
                  event: evt.title,
                  role: role
              });
          }
      });
  });

  if (myEvents.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(150);
      doc.text("Nenhuma escala encontrada para este período.", 105, startY + 40, { align: "center" });
      drawFooter(doc);
      doc.save(`Individual_${memberName}_${monthIso}.pdf`);
      return;
  }

  // @ts-ignore
  autoTable(doc, {
      body: myEvents,
      columns: [
          { header: 'DIA', dataKey: 'date' },
          { header: 'SEMANA', dataKey: 'weekday' },
          { header: 'HORÁRIO', dataKey: 'time' },
          { header: 'EVENTO', dataKey: 'event' },
          { header: 'FUNÇÃO', dataKey: 'role' },
      ],
      startY: startY + 25,
      theme: 'plain', // Theme Plain para customizar total
      headStyles: {
          fillColor: COLORS.WHITE as [number, number, number],
          textColor: COLORS.SECONDARY as [number, number, number],
          fontStyle: 'bold',
          fontSize: 9
      },
      styles: {
          cellPadding: 4,
          fontSize: 10,
          textColor: COLORS.TEXT_DARK as [number, number, number],
          valign: 'middle'
      },
      columnStyles: {
          date: { fontStyle: 'bold', textColor: COLORS.PRIMARY as [number, number, number] },
          role: { fontStyle: 'bold', textColor: COLORS.GOLD as [number, number, number] }
      },
      willDrawCell: function(data: any) {
          // Linha divisória fina entre eventos
          if (data.section === 'body' && data.column.index === 0) {
               doc.setDrawColor(240, 240, 240);
               doc.line(14, data.cell.y, 196, data.cell.y);
          }
          // Linha de cabeçalho
          if (data.section === 'head' && data.column.index === 0) {
              doc.setDrawColor(COLORS.PRIMARY[0], COLORS.PRIMARY[1], COLORS.PRIMARY[2]);
              doc.setLineWidth(0.5);
              doc.line(14, data.cell.y + data.cell.height, 196, data.cell.y + data.cell.height);
          }
      }
  });

  // Mensagem Final
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`"Tudo o que fizerem, façam de todo o coração, como para o Senhor."`, 105, Math.min(finalY + 15, doc.internal.pageSize.height - 20), { align: "center" });
  doc.text(`(Colossenses 3:23)`, 105, Math.min(finalY + 20, doc.internal.pageSize.height - 15), { align: "center" });

  drawFooter(doc);
  doc.save(`Individual_${memberName.replace(/\s/g, '_')}_${monthIso}.pdf`);
};

export interface PreparePdfScheduleParams {
  occurrences: Array<{ ruleId: string; date: string; time?: string; title: string }>;
  assignments: Array<{ event_rule_id: string; event_date: string; role: string; member_id: string }>;
  members: Array<{ id: string; name: string }>;
  roles: Role[];
}

/**
 * Converte as ocorrências e escalas (inclusive em modo rascunho / antes de liberar)
 * para a estrutura de dados esperada pelos exportadores de PDF.
 */
export const preparePdfScheduleData = ({
  occurrences,
  assignments,
  members,
  roles,
}: PreparePdfScheduleParams): {
  events: Array<{ id: string; iso: string; title: string; dateDisplay: string }>;
  schedule: Record<string, string>;
} => {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  // 1. Converte ocorrências para a estrutura esperada pelo gerador de PDF
  const events = occurrences.map((occ) => {
    const time = occ.time ? occ.time.substring(0, 5) : "00:00";
    const dateParts = occ.date.slice(0, 10).split("-");
    const dateDisplay =
      dateParts.length >= 3 ? `${dateParts[2]}/${dateParts[1]}` : occ.date;

    return {
      id: `${occ.ruleId}|${occ.date.slice(0, 10)}`,
      iso: `${occ.date.slice(0, 10)}T${time}:00`,
      title: occ.title,
      dateDisplay,
    };
  });

  // 2. Converte assignments para o mapa de chave composta `ruleId|date|role`
  const schedule: Record<string, string> = {};

  assignments.forEach((a) => {
    if (
      !a.member_id ||
      a.role === "__EVENT_EXCLUDED__" ||
      a.role === "__PUBLISHED__"
    ) {
      return;
    }

    const dateStr = a.event_date?.slice(0, 10);
    const memberName = memberMap.get(a.member_id);
    if (!memberName) return;

    // Se for coral, tratamos agrupando posteriormente
    if (a.role.toLowerCase().startsWith("coral")) {
      return;
    }

    const key = `${a.event_rule_id}|${dateStr}|${a.role}`;
    schedule[key] = memberName;
  });

  // 3. Mapeia Coral de Santa Ceia para a primeira função de vocal daquele evento
  occurrences.forEach((occ) => {
    const occDate = occ.date.slice(0, 10);
    const choirAssignments = assignments.filter(
      (a) =>
        a.event_date?.slice(0, 10) === occDate &&
        a.event_rule_id === occ.ruleId &&
        a.role.toLowerCase().startsWith("coral") &&
        Boolean(a.member_id)
    );

    if (choirAssignments.length > 0) {
      const firstVocalRole = roles.find((r) =>
        r.toLowerCase().startsWith("vocal")
      );
      if (firstVocalRole) {
        const key = `${occ.ruleId}|${occDate}|${firstVocalRole}`;
        schedule[key] = "Coral";
      }
    }
  });

  return { events, schedule };
};

