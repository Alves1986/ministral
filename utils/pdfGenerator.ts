
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
  
  let currentY = 10;
  let textStartX = 14;

  // Logo da Organização ou Sistema na ESQUERDA (tamanho similar ao dashboard)
  if (finalLogo) {
    try {
      const logoSize = 12; // Tamanho compacto similar ao dashboard
      doc.addImage(finalLogo, 'PNG', 14, currentY, logoSize, logoSize, undefined, 'FAST');
      textStartX = 14 + logoSize + 4;
    } catch (e) {
      console.warn("Could not add logo to PDF:", e);
    }
  }

  // Título Principal (Ao lado da logo)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
  doc.text(title.toUpperCase(), textStartX, currentY + 6);

  // Subtítulo (Mês/Ano) - Abaixo do título
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.TEXT_LIGHT[0], COLORS.TEXT_LIGHT[1], COLORS.TEXT_LIGHT[2]);
  doc.text(subtitle, textStartX, currentY + 11);

  currentY += 18;

  // Data de Geração discreta
  doc.setFontSize(7);
  const dateStr = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
  doc.text(dateStr, pageWidth - 14, currentY - 4, { align: "right" });
  
  // Linha separadora
  doc.setDrawColor(COLORS.TABLE_LINE[0], COLORS.TABLE_LINE[1], COLORS.TABLE_LINE[2]);
  doc.line(14, currentY - 2, pageWidth - 14, currentY - 2);
  
  return currentY + 5; // Retorna a posição Y onde a tabela deve começar
};

// Helper para rodapé
const drawFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      
      // Esquerda
      doc.text("Ministral - Excelência na escala. Propósito no servir.", 14, pageHeight - 10);
      
      // Direita (Paginação)
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: "right" });
  }
};

export const generateFullSchedulePDF = (
  ministryName: string,
  monthIso: string,
  events: { id: string; iso: string; title: string; dateDisplay: string }[],
  roles: Role[],
  schedule: ScheduleMap,
  logoUrl?: string | null
) => {
  // Landscape para caber todas as colunas
  const doc = new jsPDF({ orientation: "landscape" });
  const monthName = getMonthName(monthIso);
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const startY = drawHeader(doc, ministryName, `Escala Oficial - ${monthName}`, logoUrl);

  // Preparar Colunas
  const columns = [
    { header: "DATA", dataKey: "date" },
    { header: "HORA", dataKey: "time" },
    { header: "EVENTO", dataKey: "event" },
    ...roles.map(r => ({ header: r.toUpperCase(), dataKey: r }))
  ];

  // Preparar Dados
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
      // Lógica para lidar com 'Vocal_1', 'Vocal_2' se necessário, ou correspondência exata
      // Tenta correspondência exata primeiro
      let value = schedule[key];
      
      // Se não encontrar e o papel for "Vocal", tenta agregar (opcional, mantendo simples por enquanto)
      
      row[role] = value || "";
    });

    return row;
  });

  // CÁLCULO PARA FORÇAR UMA PÁGINA
  const availableHeight = pageHeight - startY - 20; // Margem de segurança
  const rowCount = body.length + 1;
  
  // Cálculo mais preciso da altura da linha: fontSize + (cellPadding * 2)
  // Tentamos manter cellPadding mínimo de 1.5
  let fontSize = Math.min(9, (availableHeight / rowCount) - 3);
  
  // Ajuste por largura (colunas)
  if (columns.length > 8) fontSize = Math.min(fontSize, 8);
  if (columns.length > 12) fontSize = Math.min(fontSize, 7);
  if (columns.length > 16) fontSize = Math.min(fontSize, 6);
  if (columns.length > 20) fontSize = Math.min(fontSize, 5);
  
  fontSize = Math.max(fontSize, 4.5); // Legibilidade mínima absoluta

  // Gerar Tabela
  // @ts-ignore
  autoTable(doc, {
    columns: columns,
    body: body,
    startY: startY,
    theme: 'grid',
    margin: { left: 10, right: 10, bottom: 15 },
    styles: {
      fontSize: fontSize,
      cellPadding: fontSize < 6 ? 1 : 2,
      overflow: 'linebreak',
      halign: 'left'
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
      time: { halign: 'center' },
      event: { fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250] as [number, number, number]
    },
    didParseCell: function(data: any) {
       // Remove bordas verticais para um look "SaaS Moderno"
       if (data.section === 'head') {
           data.cell.styles.lineWidth = 0; 
           // Adiciona uma linha grossa apenas embaixo do header
       }
       if (data.section === 'body' && !data.cell.raw) {
           data.cell.text = ["-"];
           data.cell.styles.textColor = [200, 200, 200];
           data.cell.styles.halign = 'center';
       }
    },
    willDrawCell: function(data: any) {
        // Adiciona linha inferior mais forte no cabeçalho
        if (data.row.index === -1 && data.section === 'head') {
            doc.setDrawColor(COLORS.PRIMARY[0], COLORS.PRIMARY[1], COLORS.PRIMARY[2]);
            doc.setLineWidth(0.5);
            doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
    }
  });

  drawFooter(doc);
  doc.save(`Escala_${ministryName.trim()}_${monthIso}.pdf`);
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
