const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwwUZqmCgcR0avtLLikC_7HBklw5JGs2-Da6mELwrGb-zDPTzi28RX2waLcbxLW6sgHKA/exec";


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


    events.forEach(event => {
      const time = document.createElement("div");

      time.className = "event-time";
      time.textContent = event.startTime;

      element.appendChild(time);
    });


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

    button.textContent =
      `${event.startTime} — ${event.organizer}`;

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

  eventDetails.innerHTML = "";

  const title = document.createElement("h2");
  title.className = "event-title";

  title.textContent =
    `${formatDateHuman(event.date)} — ${event.startTime}`;

  eventDetails.appendChild(title);


  const meta = document.createElement("div");
  meta.className = "event-meta";

  meta.textContent =
    `Organizer: ${event.organizer}`;

  eventDetails.appendChild(meta);


  let totalParticipants = 0;
  let totalDuration = 0;


  event.bands.forEach((band, index) => {
    const element = document.createElement("div");
    element.className = "band";

    const name = document.createElement("div");
    name.className = "band-name";

    name.textContent =
      `${index + 1}. ${band.name}`;

    element.appendChild(name);


    const info = document.createElement("div");
    info.className = "band-info";

    const participants =
      Number(band.members) || 0;

    const duration =
      Number(band.duration) || 0;

    totalParticipants += participants;
    totalDuration += duration;


    info.innerHTML = `
      <div>Participants: ${participants}</div>
      <div>Drums: ${band.drums ? "Yes" : "No"}</div>
      <div>Guitar amps: ${band.guitarAmps}</div>
      <div>Vocal microphones: ${band.vocalMics}</div>
      <div>Duration: ${duration} min</div>
    `;

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
    Total bands: ${event.bands.length}<br>
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