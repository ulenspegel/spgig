const calendar = document.getElementById("calendar");
const period = document.getElementById("period");
const loading = document.getElementById("loading");
const errorElement = document.getElementById("error");

const modal = document.getElementById("eventModal");
const closeModalButton = document.getElementById("closeModal");
const eventDetails = document.getElementById("eventDetails");
const copyButton = document.getElementById("copyButton");

let eventsByDate = {};
let selectedEvent = null;


async function loadEvents() {
  const range = getCalendarRange();

  period.textContent =
    `${formatDateHuman(range.from)} — ${formatDateHuman(range.to)}`;

  try {
    const url =
      `${GOOGLE_SCRIPT_URL}` +
      `?action=events` +
      `&from=${encodeURIComponent(range.from)}` +
      `&to=${encodeURIComponent(range.to)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Failed to load events");
    }

    eventsByDate = {};

    data.events.forEach(event => {
      if (!eventsByDate[event.date]) {
        eventsByDate[event.date] = [];
      }

      eventsByDate[event.date].push(event);
    });

    renderCalendar(range);

    loading.classList.add("hidden");

  } catch (error) {
    console.error(error);

    loading.classList.add("hidden");
    errorElement.textContent =
      `Failed to load events: ${error.message}`;

    errorElement.classList.remove("hidden");
  }
}


/*
 * Current month + next month.
 */
function getCalendarRange() {
  const now = new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const firstDay = new Date(
    currentYear,
    currentMonth,
    1
  );

  const lastDay = new Date(
    currentYear,
    currentMonth + 2,
    0
  );

  return {
    from: formatDate(firstDay),
    to: formatDate(lastDay)
  };
}


function renderCalendar(range) {
  calendar.innerHTML = "";

  const from = parseDate(range.from);
  const to = parseDate(range.to);

  let month = new Date(
    from.getFullYear(),
    from.getMonth(),
    1
  );

  while (month <= to) {
    renderMonth(month);
    month = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      1
    );
  }
}


function renderMonth(month) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const calendarElement = document.createElement("section");
  calendarElement.className = "calendar";

  const header = document.createElement("div");
  header.className = "calendar-header";
  header.textContent = new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric"
    }
  ).format(month);

  calendarElement.appendChild(header);


  const weekdays = document.createElement("div");
  weekdays.className = "weekdays";

  const weekdayNames = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"
  ];

  weekdayNames.forEach(name => {
    const element = document.createElement("div");

    element.className = "weekday";
    element.textContent = name;

    weekdays.appendChild(element);
  });

  calendarElement.appendChild(weekdays);


  const days = document.createElement("div");
  days.className = "days";

  const firstWeekday =
    (new Date(year, monthIndex, 1).getDay() + 6) % 7;

  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "day empty";

    days.appendChild(empty);
  }


  const daysInMonth =
    new Date(year, monthIndex + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatDate(
      new Date(year, monthIndex, day)
    );

    renderDay(days, date, day);
  }

  calendarElement.appendChild(days);
  calendar.appendChild(calendarElement);
}


function renderDay(container, date, dayNumber) {
  const element = document.createElement("div");
  element.className = "day";

  if (date === formatDate(new Date())) {
    element.classList.add("today");
  }

  const number = document.createElement("div");
  number.className = "day-number";
  number.textContent = dayNumber;

  element.appendChild(number);


  const events = eventsByDate[date];

  if (events && events.length > 0) {
    element.classList.add("has-event");

    const count = document.createElement("div");
    count.className = "event-count";

    count.textContent =
      events.length === 1
        ? "Event"
        : `${events.length} events`;

    element.appendChild(count);


    element.addEventListener("click", () => {
      if (events.length === 1) {
        showEvent(events[0]);
      } else {
        showEventSelector(events);
      }
    });
  }

  container.appendChild(element);
}


function showEventSelector(events) {
  eventDetails.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Events";

  eventDetails.appendChild(title);

  events.forEach((event, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "copy-button";

    button.textContent = event.organizer;

    button.addEventListener("click", () => {
      showEvent(event);
    });

    eventDetails.appendChild(button);
  });

  copyButton.classList.add("hidden");

  modal.classList.remove("hidden");
}


function showEvent(event) {
    selectedEvent = event;

    /*
     * Normalize bands: old or corrupted rows may contain an empty
     * or malformed bands array, which would crash the rendering.
     */
    const bands =
      (Array.isArray(event.bands) ? event.bands : []).filter(Boolean);

    if (bands.length === 0) {
      eventDetails.innerHTML = "";

      const title = document.createElement("h2");
      title.textContent = "No bands";

      eventDetails.appendChild(title);

      copyButton.classList.add("hidden");
      modal.classList.remove("hidden");

      return;
    }

    eventDetails.innerHTML = "";
  
    const title = document.createElement("h2");
    title.className = "event-title";
  
    title.textContent = formatDateHuman(event.date);
  
    eventDetails.appendChild(title);
  
  
    const meta = document.createElement("div");
    meta.className = "event-meta";
  
    meta.textContent =
      `Organizer: ${event.organizer}`;
  
    eventDetails.appendChild(meta);
  
  
    const schedule = document.createElement("div");
    schedule.className = "schedule";

    const scheduleTitle = document.createElement("h3");
    scheduleTitle.textContent = "Performance times";
    schedule.appendChild(scheduleTitle);

    const fallbackSchedule = bands.some(
      band => !band.slotStart || !band.slotEnd
    )
      ? computeScheduleFallback(bands)
      : null;

    bands.forEach((band, index) => {
      const line = document.createElement("div");

      line.textContent = band.slotStart && band.slotEnd
        ? `${band.slotStart}–${band.slotEnd} ${band.name}`
        : `${fallbackSchedule[index].start}–${fallbackSchedule[index].end} ${band.name}`;

      schedule.appendChild(line);
    });

    eventDetails.appendChild(schedule);


    const soundcheck = document.createElement("div");
    soundcheck.className = "soundcheck";

    const soundcheckTitle = document.createElement("h3");
    soundcheckTitle.textContent = "Soundchecks";
    soundcheck.appendChild(soundcheckTitle);

    const n = bands.length;
    const start = 18 * 60; // 18:00
    const end = 20 * 60; // 20:00
    const slotLength = (end - start) / n;

    // Same rotation as the form: bands 2..n first,
    // the first performing band checks sound last.
    const rotated = [...bands.slice(1), bands[0]];

    rotated.forEach((band, index) => {
      const line = document.createElement("div");

      const slotStart = start + index * slotLength;
      const slotEnd = slotStart + slotLength;

      line.textContent =
        `${formatTime(slotStart)}–${formatTime(slotEnd)} ${band.name}`;

      soundcheck.appendChild(line);
    });

    eventDetails.appendChild(soundcheck);


    let totalParticipants = 0;
    let totalDuration = 0;
  
  
    /*
     * ВАЖНО:
     * bands уже находится в порядке выступлений,
     * заданном при заполнении формы.
     *
     * Здесь НЕ сортируем bands по времени или названию.
     */
    bands.forEach((band, index) => {
      const element = document.createElement("div");
      element.className = "band";
  
  
      const name = document.createElement("div");
      name.className = "band-name";
  
      name.textContent =
        `${index + 1}. ${band.name}`;
  
  
      if (band.slotStart && band.slotEnd) {
        const slot = document.createElement("span");
        slot.className = "band-slot";
  
        slot.textContent =
          `${band.slotStart}–${band.slotEnd}`;
  
        name.appendChild(slot);
      }
  
      element.appendChild(name);
  
  
      const info = document.createElement("div");
      info.className = "band-info";
  
  
      const participants =
        Number(band.members) || 0;
  
      const duration =
        Number(band.duration) || 0;
  
      totalParticipants += participants;
      totalDuration += duration;
  
  
      const participantsLine =
        document.createElement("div");
  
      participantsLine.textContent =
        `Participants: ${participants}`;
  
      info.appendChild(participantsLine);
  
  
      const drumsLine =
        document.createElement("div");
  
      drumsLine.textContent =
        `Drums: ${band.drums ? "Yes" : "No"}`;
  
      info.appendChild(drumsLine);
  
  
      const guitarAmpsLine =
        document.createElement("div");
  
      guitarAmpsLine.textContent =
        `Guitar amps: ${band.guitarAmps}`;
  
      info.appendChild(guitarAmpsLine);
  
  
      const vocalMicsLine =
        document.createElement("div");
  
      vocalMicsLine.textContent =
        `Vocal microphones: ${band.vocalMics}`;
  
      info.appendChild(vocalMicsLine);
  
  
      const durationLine =
        document.createElement("div");
  
      durationLine.textContent =
        `Duration: ${duration} min`;
  
      info.appendChild(durationLine);
  
  
      if (band.notes && band.notes.trim()) {
        const notes = document.createElement("div");
  
        notes.className = "notes";
  
        notes.textContent =
          `Notes: ${band.notes.trim()}`;
  
        info.appendChild(notes);
      }
  
  
      element.appendChild(info);
      eventDetails.appendChild(element);
    });
  
  
    const summary = document.createElement("div");
    summary.className = "summary";
  
    summary.innerHTML = `
      Total bands: ${bands.length}<br>
      Total participants: ${totalParticipants}<br>
      Total duration: ${totalDuration} min
    `;
  
    eventDetails.appendChild(summary);
  
  
    copyButton.classList.remove("hidden");
  
    modal.classList.remove("hidden");
  }


closeModalButton.addEventListener(
  "click",
  closeModal
);


modal.addEventListener("click", event => {
  if (event.target === modal) {
    closeModal();
  }
});


function closeModal() {
  modal.classList.add("hidden");
  selectedEvent = null;
}


copyButton.addEventListener("click", async () => {
  if (!selectedEvent) {
    return;
  }

  await navigator.clipboard.writeText(
    selectedEvent.text
  );

  const oldText = copyButton.textContent;

  copyButton.textContent = "Copied";

  setTimeout(() => {
    copyButton.textContent = oldText;
  }, 1500);
});


/*
 * Same algorithm as the form (app.js): used for old events
 * saved before slotStart/slotEnd were stored.
 */
function computeScheduleFallback(bands) {
  const n = bands.length;
  const totalPerf = bands.reduce(
    (sum, band) => sum + (Number(band.duration) || 0),
    0
  );
  const changeTime = (n - 1) * 10;
  const isLongSet = totalPerf + changeTime > 120;
  const totalLength = isLongSet ? 150 : 120;

  const leftover = totalLength - totalPerf;
  const gaps = [];
  let baseGap = Math.max(10, Math.floor(leftover / (n - 1) / 5) * 5);
  let remainder = leftover - baseGap * (n - 1);

  for (let i = 0; i < n - 1; i++) {
    let gap = baseGap;

    if (remainder >= 5) {
      gap += 5;
      remainder -= 5;
    }

    gaps.push(gap);
  }

  const endTime = 23 * 60; // 23:00 in minutes
  let current = endTime - totalLength;

  return bands.map((band, index) => {
    const duration = Number(band.duration) || 0;
    const start = current;
    const end = start + duration;

    current = end + (gaps[index] || 0);

    return {
      start: formatTime(start),
      end: formatTime(end)
    };
  });
}


function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}


function formatDate(date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function parseDate(value) {
  const [year, month, day] =
    value.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}


function formatDateHuman(value) {
  const date =
    typeof value === "string"
      ? parseDate(value)
      : value;

  return new Intl.DateTimeFormat(
    "en-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  ).format(date);
}


loadEvents();