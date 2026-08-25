const bandCountInput = document.getElementById("bandCount");
const bandsContainer = document.getElementById("bands");
const orderList = document.getElementById("orderList");
const eventForm = document.getElementById("eventForm");
const saveButton = document.getElementById("saveButton");
const result = document.getElementById("result");
const resultText = document.getElementById("resultText");
const copyButton = document.getElementById("copyButton");
const status = document.getElementById("status");

let bands = [];

bandCountInput.addEventListener("input", updateBandCount);

function updateBandCount() {
  let count = Number(bandCountInput.value);

  if (!Number.isInteger(count) || count < 1) {
    count = 1;
  }

  const oldBands = bands;

  bands = [];

  for (let i = 0; i < count; i++) {
    bands.push(
      oldBands[i] || {
        name: "",
        members: "",
        drums: false,
        guitarAmps: 0,
        vocalMics: 0,
        duration: "",
        notes: ""
      }
    );
  }

  renderBands();
  renderOrder();
}

function renderBands() {
  bandsContainer.innerHTML = "";

  bands.forEach((band, index) => {
    const element = document.createElement("div");
    element.className = "band";

    element.innerHTML = `
      <h3>Банда ${index + 1}</h3>

      <label>
        Название
        <input
          type="text"
          data-index="${index}"
          data-field="name"
          value="${escapeHtml(band.name)}"
          required
        >
      </label>

      <div class="band-grid">
        <label>
          Количество участников
          <input
            type="number"
            min="1"
            data-index="${index}"
            data-field="members"
            value="${band.members}"
            required
          >
        </label>

        <label>
          Длительность, минут
          <input
            type="number"
            min="1"
            data-index="${index}"
            data-field="duration"
            value="${band.duration}"
            required
          >
        </label>

        <label>
          Гитарных усилителей
          <input
            type="number"
            min="0"
            data-index="${index}"
            data-field="guitarAmps"
            value="${band.guitarAmps}"
          >
        </label>

        <label>
          Вокальных микрофонов
          <input
            type="number"
            min="0"
            data-index="${index}"
            data-field="vocalMics"
            value="${band.vocalMics}"
          >
        </label>
      </div>

      <label>
        <input
          type="checkbox"
          data-index="${index}"
          data-field="drums"
          ${band.drums ? "checked" : ""}
        >
        Есть ли барабаны
      </label>

      <label>
        Примечания
        <textarea
          data-index="${index}"
          data-field="notes"
        >${escapeHtml(band.notes)}</textarea>
      </label>
    `;

    bandsContainer.appendChild(element);
  });

  bandsContainer.querySelectorAll("input, textarea").forEach(input => {
    input.addEventListener("input", updateBand);
    input.addEventListener("change", updateBand);
  });
}

function updateBand(event) {
  const input = event.target;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;

  if (input.type === "checkbox") {
    bands[index][field] = input.checked;
  } else {
    bands[index][field] = input.value;
  }

  if (field === "name") {
    renderOrder();
  }
}

function renderOrder() {
  orderList.innerHTML = "";

  bands.forEach((band, index) => {
    const item = document.createElement("div");

    item.className = "order-item";
    item.draggable = true;
    item.dataset.index = index;
    item.textContent = band.name || `Банда ${index + 1}`;

    item.addEventListener("dragstart", dragStart);
    item.addEventListener("dragover", dragOver);
    item.addEventListener("drop", drop);

    orderList.appendChild(item);
  });
}

let draggedIndex = null;

function dragStart(event) {
  draggedIndex = Number(event.currentTarget.dataset.index);
  event.currentTarget.classList.add("dragging");
}

function dragOver(event) {
  event.preventDefault();
}

function drop(event) {
  event.preventDefault();

  const targetIndex = Number(event.currentTarget.dataset.index);

  if (draggedIndex === null || draggedIndex === targetIndex) {
    return;
  }

  const moved = bands.splice(draggedIndex, 1)[0];
  bands.splice(targetIndex, 0, moved);

  draggedIndex = null;

  renderBands();
  renderOrder();
}

eventForm.addEventListener("submit", async event => {
  event.preventDefault();

  saveButton.disabled = true;
  status.textContent = "Сохраняю...";

  const data = {
    date: document.getElementById("date").value,
    startTime: document.getElementById("startTime").value,
    organizer: document.getElementById("organizer").value,
    bands: bands
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    const responseData = await response.json();

    if (!responseData.ok) {
      throw new Error(responseData.error || "Ошибка сохранения");
    }

    resultText.value = responseData.text;
    result.classList.remove("hidden");

    status.textContent = "Сохранено";
  } catch (error) {
    console.error(error);
    status.textContent = "Ошибка: " + error.message;
  } finally {
    saveButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(resultText.value);

  const oldText = copyButton.textContent;
  copyButton.textContent = "Скопировано";

  setTimeout(() => {
    copyButton.textContent = oldText;
  }, 1500);
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
 * Сюда потом вставим URL опубликованного Google Apps Script.
 */
const GOOGLE_SCRIPT_URL = "PASTE_GOOGLE_SCRIPT_URL_HERE";

updateBandCount();