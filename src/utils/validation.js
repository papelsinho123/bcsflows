const parseIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const isValidDate = (value) => Boolean(parseIsoDate(value));

export const validateEventForm = (form, eventAssignments = []) => {
  const errors = [];

  if (!String(form.name || '').trim()) {
    errors.push({ field: 'name', message: 'Informe o nome do evento.' });
  }

  if (form.departureDate && !isValidDate(form.departureDate)) {
    errors.push({ field: 'departureDate', message: 'Data de partida inválida.' });
  }

  if (form.startDate && !isValidDate(form.startDate)) {
    errors.push({ field: 'startDate', message: 'Data inicial do evento inválida.' });
  }

  if (form.endDate && !isValidDate(form.endDate)) {
    errors.push({ field: 'endDate', message: 'Data final do evento inválida.' });
  }

  if (form.returnDate && !isValidDate(form.returnDate)) {
    errors.push({ field: 'returnDate', message: 'Data de retorno inválida.' });
  }

  const departureDate = parseIsoDate(form.departureDate);
  const startDate = parseIsoDate(form.startDate);
  const endDate = parseIsoDate(form.endDate);
  const returnDate = parseIsoDate(form.returnDate);

  if (departureDate && returnDate && departureDate > returnDate) {
    errors.push({ field: 'departureDate', message: 'A data de partida não pode ser posterior à data de retorno.' });
  }

  if (startDate && endDate && startDate > endDate) {
    errors.push({ field: 'startDate', message: 'A data de início do evento não pode ser posterior à data final do evento.' });
  }

  if (returnDate && startDate && returnDate < startDate) {
    errors.push({ field: 'returnDate', message: 'A data de retorno não pode ser anterior ao início do evento.' });
  }

  if (returnDate && endDate && returnDate < endDate) {
    errors.push({ field: 'returnDate', message: 'A data de retorno não pode ser anterior ao término do evento.' });
  }

  if (departureDate && endDate && departureDate > endDate) {
    errors.push({ field: 'departureDate', message: 'A data de partida não pode ser posterior ao término do evento.' });
  }

  if (eventAssignments && eventAssignments.length) {
    eventAssignments.forEach((assignment) => {
      const assignmentDeparture = parseIsoDate(assignment.departureDate || assignment.startDate);
      const assignmentReturn = parseIsoDate(assignment.returnDate);

        if (assignmentDeparture && endDate && assignmentDeparture > endDate) {
        errors.push({ field: 'users', message: 'A data de partida do profissional não pode ser posterior ao término do evento.' });
      }
      if (assignmentReturn && endDate && assignmentReturn < endDate) {
        errors.push({ field: 'users', message: 'A data de retorno do profissional não pode ser anterior ao término do evento.' });
      }
      if (assignmentDeparture && assignmentReturn && assignmentDeparture > assignmentReturn) {
        errors.push({ field: 'users', message: 'A data de partida do profissional não pode ser posterior à data de retorno do profissional.' });
      }
    });
  }

  return errors;
};

export const validateInventoryForm = (form) => {
  const errors = [];

  if (!String(form.type || '').trim()) {
    errors.push({ field: 'type', message: 'Selecione o tipo de equipamento.' });
  }

  if (!String(form.name || '').trim()) {
    errors.push({ field: 'name', message: 'Informe o nome do equipamento.' });
  }

  const quantity = Number(form.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) {
    errors.push({ field: 'quantity', message: 'A quantidade deve ser maior que zero.' });
  }

  return errors;
};
