import jsPDF from 'jspdf';

const formatDate = (value) => {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateShort = (value) => {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
};

export function generateSeparationPdf(eventData, separationItems, nfContact) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const lineHeight = 20;
  let y = margin;

  doc.setFillColor('#e6ecf5');
  doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

  doc.setFontSize(22);
  doc.setTextColor('#24324d');
  doc.text('Relatório de Separação de Equipamentos', margin, y);
  y += lineHeight * 2;

  doc.setFontSize(12);
  doc.text(`Evento: ${eventData.name}`, margin, y);
  y += lineHeight;
  doc.text(`Cliente: ${eventData.clientName}`, margin, y);
  y += lineHeight;
  doc.text(`Local: ${eventData.locationName}`, margin, y);
  y += lineHeight;
  const eventDateDisplay = eventData.startDate || eventData.eventDate || eventData.departureDate || 'Não informado';
  doc.text(`Data do Evento: ${eventDateDisplay}`, margin, y);
  y += lineHeight;
  if (eventData.organizerName) {
    doc.text(`Organizadora: ${eventData.organizerName}`, margin, y);
    y += lineHeight;
  }
  doc.text(`Responsável NF: ${nfContact.name} - ${nfContact.email}`, margin, y);
  y += lineHeight * 2;

  doc.setFontSize(14);
  doc.text('Itens de Separação', margin, y);
  y += lineHeight;

  separationItems.forEach((item, index) => {
    // compute displayed total: contract + backup - incoming transfers
    const incomingSum = Array.isArray(item?.incomingTransfers) ? item.incomingTransfers.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0;
    const rentalSum = Array.isArray(item?.externalRentals) ? item.externalRentals.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0;
    const contractVal = Number(item?.contractQuantity ?? item?.quantity ?? 0) || 0;
    const backupVal = Number(item?.backupQuantity ?? 1) || 1;
    const displayedQty = Math.max(0, contractVal + backupVal - incomingSum - rentalSum);
    // skip visual transfer-only entries marked excludeFromNF
    if (item && item.excludeFromNF) return;
    if (y > doc.internal.pageSize.height - margin - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.text(`${index + 1}. ${item.type} - ${item.name}`, margin, y);
    doc.text(`Qtd: ${displayedQty}`, margin + 330, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.text(`Status: ${item.status || 'Normal'}`, margin + 10, y);
    y += lineHeight;
  });

  doc.save(`${eventData.name.replace(/\s+/g, '_')}_separacao.pdf`);
}

export function generateMountedItemsPdf(eventData, items) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const lineHeight = 18;
  let y = margin;

  const addLine = (text, indent = 0) => {
    if (y > doc.internal.pageSize.height - margin - 30) {
      doc.addPage();
      y = margin;
    }
    doc.text(text, margin + indent, y);
    y += lineHeight;
  };

  doc.setFillColor('#e6ecf5');
  doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

  doc.setFontSize(22);
  doc.setTextColor('#24324d');
  doc.text('Relatório de Itens Montados', margin, y);
  y += lineHeight * 2;

  doc.setFontSize(12);
  addLine(`Evento: ${eventData.name || 'Não informado'}`);
  addLine(`Data do Evento: ${eventData.startDate || eventData.departureDate || eventData.eventDate || 'Não informado'}`);
  addLine(`Local: ${eventData.locationName || 'Não informado'}`);
  y += lineHeight;

  if (!Array.isArray(items) || items.length === 0) {
    addLine('Nenhum item montado marcado.');
  } else {
    items.forEach((item, index) => {
      const quantity = Number(item.realQuantity ?? item.quantity ?? 0) || 0;
      const confirmedText = item.realQuantityConfirmed ? ' (confirmada)' : '';
      addLine(`${index + 1}. ${item.name || item.type || 'Equipamento'}`);
      addLine(`   Setor: ${item.sector || 'OUTRO SETOR'}`, 10);
      if (item.mountDate) addLine(`   Data de montagem: ${item.mountDate}`, 10);
      addLine(`   Quantidade montada: ${quantity}${confirmedText}`, 10);
      addLine('');
    });
  }

  const fileName = `${eventData.name.replace(/\s+/g, '_')}_itens_montados.pdf`;
  doc.save(fileName);
}

export function generateProfessionalSchedulePdf(user, assignments, month) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const lineHeight = 18;
  let y = margin;

  const addLine = (text, indent = 0) => {
    if (y > doc.internal.pageSize.height - margin - 30) {
      doc.addPage();
      y = margin;
    }
    doc.text(text, margin + indent, y);
    y += lineHeight;
  };

  const monthLabel = month ? new Date(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Período';

  doc.setFillColor('#e6ecf5');
  doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

  doc.setFontSize(22);
  doc.setTextColor('#24324d');
  doc.text(`Relatório de Diárias - ${user.name}`, margin, y);
  y += lineHeight * 2;

  doc.setFontSize(12);
  addLine(`Profissional: ${user.name}`);
  const normalizedRole = String(user.role || '').trim().toLowerCase();
  addLine(`Cargo: ${normalizedRole === 'admin' ? 'Administrador' : normalizedRole === 'master' ? 'Master' : 'Usuário'}`);
  addLine(`Período: ${monthLabel}`);
  y += lineHeight;

  if (assignments.length === 0) {
    addLine('Nenhuma diária ou evento agendado para este período.');
  } else {
    addLine('Eventos e diárias:');
    addLine('');

    assignments.forEach((assignment, index) => {
      addLine(`${index + 1}. ${assignment.eventName}`);
      addLine(`   Início: ${formatDate(assignment.start)}`);
      addLine(`   Término: ${formatDate(assignment.end)}`);
      addLine(`   Dias: ${assignment.days}`);
      addLine('');
    });

    const totalDays = assignments.reduce((sum, assignment) => sum + (assignment.days || 0), 0);
    addLine(`Total de diárias no período: ${totalDays}`);
  }

  const fileName = `${user.name.replace(/\s+/g, '_')}_diarias_${month || 'relatorio'}.pdf`;
  doc.save(fileName);
}

export function generateProfessionalSchedulesPdf(users, rows, month) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const lineHeight = 18;
  let y = margin;

  const addLine = (text, indent = 0) => {
    if (y > doc.internal.pageSize.height - margin - 30) {
      doc.addPage();
      y = margin;
    }
    doc.text(text, margin + indent, y);
    y += lineHeight;
  };

  const monthLabel = month ? new Date(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Período';

  doc.setFillColor('#e6ecf5');
  doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

  doc.setFontSize(22);
  doc.setTextColor('#24324d');
  doc.text('Relatório de Diárias - Todos os Profissionais', margin, y);
  y += lineHeight * 2;

  doc.setFontSize(12);
  addLine(`Período: ${monthLabel}`);
  addLine(`Total de profissionais: ${Array.isArray(users) ? users.length : 0}`);
  y += lineHeight;

  if (!Array.isArray(rows) || rows.length === 0) {
    addLine('Nenhum profissional ou evento encontrado para este período.');
  } else {
    rows.forEach((row, rowIndex) => {
      const user = row.user;
      if (!user) return;

      const normalizedRole = String(user.role || '').trim().toLowerCase();
      addLine(`${rowIndex + 1}. ${user.name} (${normalizedRole === 'admin' ? 'Administrador' : normalizedRole === 'master' ? 'Master' : 'Usuário'})`, 0);
      addLine(`   Total de dias: ${row.totalDays}`, 0);
      if (row.assignments.length === 0) {
        addLine('   Sem eventos atribuídos', 0);
      } else {
        row.assignments.forEach((assignment, assignmentIndex) => {
          addLine(`   ${assignmentIndex + 1}. ${assignment.eventName}`, 10);
          addLine(`      Início: ${formatDate(assignment.start)}`, 10);
          addLine(`      Término: ${formatDate(assignment.end)}`, 10);
          addLine(`      Dias: ${assignment.days}`, 10);
        });
      }

      if (rowIndex < rows.length - 1) {
        y += lineHeight;
        if (y > doc.internal.pageSize.height - margin - lineHeight * 6) {
          doc.addPage();
          y = margin;
        } else {
          addLine('');
        }
      }
    });
  }

  const fileName = `de_ativos_diarias_${month || 'relatorio'}.pdf`;
  doc.save(fileName);
}

export function generateExternalRentalsPdf(rentals, month, company) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const lineHeight = 18;
  let y = margin;

  const addLine = (text, indent = 0) => {
    if (y > doc.internal.pageSize.height - margin - 30) {
      doc.addPage();
      y = margin;
    }
    doc.text(text, margin + indent, y);
    y += lineHeight;
  };

  const monthLabel = month ? new Date(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Todos os meses';
  const companyLabel = company ? company : 'Todas as empresas';

  doc.setFillColor('#e6ecf5');
  doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

  doc.setFontSize(22);
  doc.setTextColor('#24324d');
  doc.text('Relatório de Locações Externas', margin, y);
  y += lineHeight * 2;

  doc.setFontSize(12);
  addLine(`Período: ${monthLabel}`);
  addLine(`Empresa: ${companyLabel}`);
  addLine(`Total de entradas: ${Array.isArray(rentals) ? rentals.length : 0}`);
  y += lineHeight;

  if (!Array.isArray(rentals) || rentals.length === 0) {
    addLine('Nenhuma locação externa encontrada para o filtro selecionado.');
  } else {
    rentals.forEach((rental, index) => {
      addLine(`${index + 1}. ${rental.equipmentType || 'Equipamento não informado'}`);
      addLine(`   Evento: ${rental.eventName || 'Não informado'}`, 10);
      addLine(`   Empresa: ${rental.company || 'Não informada'}`, 10);
      addLine(`   Quantidade: ${rental.quantity || 0}`, 10);
      addLine(`   Recebimento: ${formatDate(rental.startDate)}`, 10);
      addLine(`   Devolução: ${formatDate(rental.endDate)}`, 10);
      addLine(`   Dias alugados: ${rental.days || 0}`, 10);
      addLine('');
    });
  }

  const sanitizedCompany = company ? company.replace(/[^a-zA-Z0-9]+/g, '_') : 'todas';
  const fileName = `locacoes_externas_${month || 'todos'}_${sanitizedCompany}.pdf`;
  doc.save(fileName);
}

export function generateFinancePdf(eventData, config, paymentTypeFilter) {
  let finances = Array.isArray(eventData.finances) ? eventData.finances : [];
  if (paymentTypeFilter && paymentTypeFilter !== 'ALL') {
    finances = finances.filter((f) => (f.paymentType || 'Sem pagamento') === paymentTypeFilter);
  }
  // ordenar por data: mais antigo em cima, mais recente embaixo
  finances = finances.slice().sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return (da || 0) - (db || 0);
  });
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const lineHeight = 16;
  let y = margin;

  const addLine = (text, indent = 0) => {
    if (y > doc.internal.pageSize.height - margin - 30) {
      doc.addPage();
      y = margin;
    }
    doc.text(text, margin + indent, y);
    y += lineHeight;
  };

  doc.setFontSize(18);
  doc.text(`Relatório Financeiro - ${eventData.name || ''}`, margin, y);
  y += lineHeight * 1.5;

  doc.setFontSize(11);
  addLine(`Período: ${formatDateShort(eventData.departureDate) || ''} → ${formatDateShort(eventData.returnDate) || ''}`);
  addLine(`Responsável NF: ${config?.nfContact?.name || '-'} • ${config?.nfContact?.email || ''}`);
  addLine('');

  addLine('Lançamentos:');
  addLine('');

  finances.forEach((f, idx) => {
    const expenseLabel = f.expenseType === 'OUTRO' && f.otherType ? `${f.expenseType} (${f.otherType})` : (f.expenseType || '-');
    const dateLabel = f.date ? formatDateShort(f.date) : '-';
    const label = `${dateLabel} | ${f.createdByName || f.createdBy || '-'} | ${f.type || '-'} | ${expenseLabel} | ${f.paymentType || 'Sem pagamento'} | ${Number(f.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    addLine(`${idx + 1}. ${label}`);
    if (f.note) addLine(`   Obs: ${f.note}`, 10);
  });

  addLine('');
  const totalAll = finances.reduce((s, i) => s + Number(i.amount || 0), 0);
  addLine(`Total geral: ${totalAll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);

  const byType = finances.reduce((acc, i) => {
    const key = i.expenseType === 'OUTRO' && i.otherType ? `OUTRO (${i.otherType})` : (i.expenseType || 'Sem tipo');
    acc[key] = (acc[key] || 0) + Number(i.amount || 0);
    return acc;
  }, {});

  addLine('');
  addLine('Totais por tipo:');
  Object.keys(byType).forEach((t) => addLine(`- ${t}: ${byType[t].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 6));

  const personalSum = finances.filter((i) => String(i.type || '').toLowerCase() === 'pessoal').reduce((s, i) => s + Number(i.amount || 0), 0);
  if (personalSum > 0) addLine('', 0), addLine(`Total para reembolso (pessoal): ${personalSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);

  const fileName = `${(eventData.name || 'relatorio_financeiro').replace(/\s+/g, '_')}_financeiro.pdf`;
  doc.save(fileName);
}

export function generateEventChecklistPdf(eventData, config) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const lineHeight = 18;
  let y = margin;

  const addLine = (text, indent = 0) => {
    if (y > doc.internal.pageSize.height - margin - 30) {
      doc.addPage();
      y = margin;
    }
    doc.text(text, margin + indent, y);
    y += lineHeight;
  };

  doc.setFillColor('#e6ecf5');
  doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');

  doc.setFontSize(22);
  doc.setTextColor('#24324d');
  doc.text('Checklist de Evento', margin, y);
  y += lineHeight * 2;

  doc.setFontSize(12);
  addLine(`Nome do Evento: ${eventData.name || 'Não informado'}`);
  addLine(`Cliente: ${eventData.clientName || 'Não informado'}`);
  addLine(`Responsável: ${eventData.organizerName || 'Não informado'}`);
  addLine(`Local: ${eventData.locationName || 'Não informado'}`);
  addLine(`Endereço: ${eventData.address || 'Não informado'}`);
  addLine(`Contato: ${eventData.contact || 'Não informado'}`);
  addLine(`Datas: ${formatDate(eventData.startDate)} até ${formatDate(eventData.endDate)}`);
  addLine(`Partida: ${formatDate(eventData.departureDate)} | Retorno: ${formatDate(eventData.returnDate)}`);
  addLine(`Tamanho da etiqueta: ${eventData.labelSize || 'Não informado'}`);
  y += lineHeight;

  const extraMessages = Array.isArray(eventData.extraInfoMessages)
    ? eventData.extraInfoMessages
    : (eventData.extraInfo ? [{ text: eventData.extraInfo, userName: 'Sistema' }] : []);

  if (extraMessages.length > 0) {
    const wrappedExtraLines = [];

    extraMessages.forEach((message) => {
      const text = typeof message === 'string' ? message : message.text;
      const userName = typeof message === 'string' ? '' : (message.userName ? `Usuário: ${message.userName}` : '');
      const timestamp = typeof message === 'string' ? '' : (message.createdAt ? ` | ${new Date(message.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : '');

      const cleanedText = `${text}`.trim();
      if (cleanedText) {
        const wrappedText = doc.splitTextToSize(cleanedText, doc.internal.pageSize.width - margin * 2 - 76);
        wrappedExtraLines.push(...wrappedText);
      }

      const metadata = `${userName}${timestamp}`.trim();
      if (metadata) {
        const wrappedMetadata = doc.splitTextToSize(metadata, doc.internal.pageSize.width - margin * 2 - 88);
        wrappedExtraLines.push(...wrappedMetadata);
      }

      wrappedExtraLines.push('');
    });

    const boxHeight = 34 + lineHeight * (2 + wrappedExtraLines.length) + 10;
    const boxY = y;

    if (boxY + boxHeight > doc.internal.pageSize.height - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor('#ecfdf5');
    doc.setDrawColor('#10b981');
    doc.setLineWidth(1.2);
    doc.rect(margin - 8, y - 6, doc.internal.pageSize.width - margin * 2 + 16, boxHeight, 'FD');

    doc.setFontSize(13);
    doc.setTextColor('#047857');
    doc.text('INFORMAÇÕES EXTRAS', margin, y + lineHeight * 0.85);

    doc.setFontSize(11);
    doc.setTextColor('#1f2937');

    let currentY = y + lineHeight * 2;
    wrappedExtraLines.forEach((line) => {
      if (line.trim() === '') {
        currentY += lineHeight * 0.22;
        return;
      }

      doc.text(line, margin + 10, currentY);
      currentY += lineHeight;
    });

    y = y + boxHeight + 6;
  }

  const accommodationItems = eventData.boards?.hospedagem || [];
  addLine('Hospedagem:');
  if (accommodationItems.length > 0) {
    accommodationItems.forEach((item, index) => {
      const lodgingName = item.accommodationName || item.name || 'Hospedagem';
      const lodgingAddress = item.accommodationAddress || item.address || 'Não informado';
      addLine(`${index + 1}. ${lodgingName}`, 10);
      addLine(`   - Endereço: ${lodgingAddress}`, 10);
    });
  } else {
    const accommodation = eventData.accommodation || { type: 'NONE' };
    addLine(`- Tipo: ${accommodation.type || 'NONE'}`, 10);
    if (accommodation.type === 'HOTEL') {
      addLine(`- Hotel: ${accommodation.hotelName || 'Não informado'}`, 10);
      addLine(`- Endereço: ${accommodation.address || 'Não informado'}`, 10);
    } else if (accommodation.type === 'AIRBNB') {
      addLine(`- Endereço: ${accommodation.address || 'Não informado'}`, 10);
    } else {
      addLine('- Não há hospedagem registrada', 10);
    }
  }
  y += lineHeight;

  addLine('Deslocamento:');
  if (eventData.boards?.deslocamento?.length) {
    eventData.boards.deslocamento.forEach((item, index) => {
      addLine(`${index + 1}. ${item.transportMode || item.name || 'Transporte'}`, 10);
      if (item.vehicleModel) addLine(`   - Veículo: ${item.vehicleModel}`, 10);
      if (item.company) addLine(`   - Empresa: ${item.company}`, 10);
      if (item.reservationCode || item.passageCode) addLine(`   - Código da reserva: ${item.reservationCode || item.passageCode}`, 10);
      if (item.departureDate || item.returnDate) addLine(`   - Data ida: ${formatDate(item.departureDate)} | Data volta: ${formatDate(item.returnDate)}`, 10);
      if (item.departureTime || item.returnTime) addLine(`   - Hora ida: ${item.departureTime || '-'} | Hora volta: ${item.returnTime || '-'}`, 10);
    });
  } else {
    addLine('- Não há deslocamento registrado', 10);
  }
  y += lineHeight;

  addLine('Equipamentos para levar:');
  if (eventData.boards?.montagem?.length) {
    const equipmentTotals = new Map();
    eventData.boards.montagem.forEach((item) => {
      const type = item.type || 'Equipamento';
      const quantity = Number(item.quantity) || 1;
      equipmentTotals.set(type, (equipmentTotals.get(type) || 0) + quantity);
    });

    Array.from(equipmentTotals.entries()).forEach(([type, total]) => {
      addLine(`- ${type}: ${total} ${total === 1 ? 'equipamento' : 'equipamentos'}`, 10);
    });
  } else {
    addLine('- Nenhum equipamento adicionado', 10);
  }

  const transferItems = (eventData.boards?.separar || []).filter((item) => item.transferReference || item.isTransferred || item.transferObservation);
  if (transferItems.length > 0) {
    y += lineHeight;
    addLine('Transferências de equipamentos:');
    transferItems.forEach((item, index) => {
      const direction = item.isTransferred ? 'Recebido' : 'Enviado';
      const detail = item.transferObservation || `Transferência ${direction}`;
      addLine(`${index + 1}. ${item.name || item.type} | ${detail}`, 10);
    });
  }

  doc.save(`${eventData.name.replace(/\s+/g, '_')}_checklist.pdf`);
}
