const SHEET_NAME = 'Events';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    validateData(data);

    const sheet = getEventsSheet();
    const text = buildText(data);

    const row = [
      data.date,
      data.startTime,
      data.organizer,
      data.bands.length,
      JSON.stringify(data.bands),
      text,
      new Date()
    ];

    const existingRow = findRowByDateAndOrganizer(
      sheet,
      data.date,
      data.organizer
    );

    if (existingRow !== -1) {
      sheet
        .getRange(existingRow, 1, 1, row.length)
        .setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return jsonResponse({
      ok: true,
      text: text
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      ok: false,
      error: error.message
    });
  }
}


function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'events') {
      return getEvents(e.parameter.from, e.parameter.to);
    }

    return jsonResponse({
      ok: true,
      message: 'Event form API is running'
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      ok: false,
      error: error.message
    });
  }
}

function getEventsSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);

    sheet.appendRow([
      'Date',
      'Start time',
      'Organizer',
      'Bands',
      'JSON',
      'Text',
      'Updated'
    ]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}


function findRowByDateAndOrganizer(sheet, date, organizer) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return -1;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 3)
    .getDisplayValues();

  const normalizedOrganizer = organizer.trim();

  for (let i = 0; i < values.length; i++) {
    const rowDate = values[i][0];
    const rowOrganizer = values[i][2].trim();

    if (
      rowDate === date &&
      rowOrganizer === normalizedOrganizer
    ) {
      return i + 2;
    }
  }

  return -1;
}


function validateData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data');
  }

  if (!data.date) {
    throw new Error('Date is required');
  }

  if (!data.organizer || !data.organizer.trim()) {
    throw new Error('Organizer is required');
  }

  if (!Array.isArray(data.bands) || data.bands.length === 0) {
    throw new Error('No bands provided');
  }

  data.bands.forEach((band, index) => {
    if (!band.name || !band.name.trim()) {
      throw new Error(
        `Band ${index + 1}: name is required`
      );
    }

    if (!band.members || Number(band.members) < 1) {
      throw new Error(
        `Band ${index + 1}: invalid number of participants`
      );
    }

    if (!band.duration || Number(band.duration) < 1) {
      throw new Error(
        `Band ${index + 1}: invalid duration`
      );
    }
  });
}


function buildText(data) {
  const lines = [];

  lines.push(`${formatDate(data.date)}`);
  lines.push(`Organizer: ${data.organizer}`);
  lines.push('');

  const n = data.bands.length;

  // Performance slots as computed by the form.
  lines.push('Performance times');
  data.bands.forEach((band, index) => {
    if (band.slotStart && band.slotEnd) {
      lines.push(`${band.slotStart}–${band.slotEnd} ${band.name}`);
    } else {
      lines.push(`${index + 1}. ${band.name}`);
    }
  });
  lines.push('');

  // Soundcheck slots: 18:00–20:00 split evenly,
  // bands 2..n first, the first performing band last.
  const scStart = 18 * 60;
  const scSlot = (2 * 60) / n;
  const rotated = data.bands.slice(1).concat([data.bands[0]]);

  lines.push('Soundchecks:');
  rotated.forEach((band, index) => {
    const start = scStart + index * scSlot;
    const end = start + scSlot;
    lines.push(`${formatTime(start)}–${formatTime(end)} ${band.name}`);
  });
  lines.push('');

  let totalDuration = 0;
  let totalParticipants = 0;

  data.bands.forEach((band, index) => {
    const duration = Number(band.duration) || 0;
    const members = Number(band.members) || 0;

    totalDuration += duration;
    totalParticipants += members;

    lines.push(`${index + 1}. ${band.name}`);
    lines.push(`\tParticipants: ${members}`);
    lines.push(`\tDrums: ${band.drums ? 'Yes' : 'No'}`);
    lines.push(`\tGuitar amps: ${band.guitarAmps}`);
    lines.push(`\tVocal microphones: ${band.vocalMics}`);
    lines.push(`\tDuration: ${duration} min`);

    if (band.notes && band.notes.trim()) {
      lines.push(`\tNotes: ${band.notes.trim()}`);
    }

    lines.push('');
  });

  lines.push('────────────────────');
  lines.push(`Total bands: ${data.bands.length}`);
  lines.push(`Total participants: ${totalParticipants}`);
  lines.push(`Total duration: ${totalDuration} min`);

  return lines.join('\n');
}


function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}


function formatDate(date) {
  const parts = date.split('-');

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}


function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getEvents(from, to) {
  const sheet = getEventsSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return jsonResponse({
      ok: true,
      events: []
    });
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 7)
    .getDisplayValues();

  const events = [];

  values.forEach(row => {
    const date = row[0];

    if (from && date < from) {
      return;
    }

    if (to && date > to) {
      return;
    }

    let bands = [];

    try {
      bands = JSON.parse(row[4]);
    } catch (error) {
      console.error('Invalid JSON for date:', date);
    }

    events.push({
      date: date,
      startTime: row[1],
      organizer: row[2],
      bandsCount: Number(row[3]),
      bands: bands,
      text: row[5],
      updated: row[6]
    });
  });

  return jsonResponse({
    ok: true,
    events: events
  });
}