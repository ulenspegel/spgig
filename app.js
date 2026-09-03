// ============================================================
// Band lineup form — app.js
// ============================================================

const bandCountInput = document.getElementById("bandCount");
const bandsContainer = document.getElementById("bands");
const orderList = document.getElementById("orderList");
const soundcheckList = document.getElementById("soundcheckList");
const eventForm = document.getElementById("eventForm");
const saveButton = document.getElementById("saveButton");
const result = document.getElementById("result");
const resultText = document.getElementById("resultText");
const copyButton = document.getElementById("copyButton");
const status = document.getElementById("status");
const changeoverMinus = document.getElementById("changeoverMinus");
const changeoverPlus = document.getElementById("changeoverPlus");
const changeoverValue = document.getElementById("changeoverValue");

let bands = [];

// Change-over time between bands, minutes (10–60, step 5).
let changeOver = 20;

// Soundcheck order as indices into `bands`.
// The last slot always belongs to the first performing band.
let soundcheckOrder = [];

// ============================================================
// Band count management
// ============================================================

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

	rebuildSoundcheckOrder();
	renderBands();
	renderOrder();
	renderSoundcheck();
}

// ============================================================
// Rendering
// ============================================================

function rebuildSoundcheckOrder() {
	const indices = bands.map((_, index) => index);

	// Default: bands 2..n first, the first performing band last.
	soundcheckOrder = indices.length > 0
		? [...indices.slice(1), indices[0]]
		: [];
}

function computeSoundcheckSchedule() {
	const n = bands.length;
	const start = 18 * 60; // 18:00
	const slotLength = (2 * 60) / n; // 18:00–20:00 split evenly

	return bands.map((_, bandIndex) => {
		const slot = soundcheckOrder.indexOf(bandIndex);
		const slotStart = start + slot * slotLength;
		const slotEnd = slotStart + slotLength;

		return {
			start: formatTime(slotStart),
			end: formatTime(slotEnd)
		};
	});
}

function renderBands() {
	bandsContainer.innerHTML = "";

	bands.forEach((band, index) => {
		const element = document.createElement("div");
		element.className = "band";

		element.innerHTML = `
			<h3>Band ${index + 1}</h3>

			<label>
				Name
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
					Members
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
					Performance duration, minutes
					<input
						type="number"
						min="1"
						max="120"
						data-index="${index}"
						data-field="duration"
						value="${band.duration}"
						required
					>
				</label>

				<label>
					Guitar amps
					<input
						type="number"
						min="0"
						max="2"
						data-index="${index}"
						data-field="guitarAmps"
						value="${band.guitarAmps}"
					>
				</label>

				<label>
					Vocal mics
					<input
						type="number"
						min="0"
						max="5"
						data-index="${index}"
						data-field="vocalMics"
						value="${band.vocalMics}"
					>
				</label>
			</div>

			<label class="checkbox">
				<input
					type="checkbox"
					data-index="${index}"
					data-field="drums"
					${band.drums ? "checked" : ""}
				>
				Use drum set
			</label>

			<label>
				Notes
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

function computeSchedule() {
	const n = bands.length;
	const endTime = 23 * 60; // The last band always ends at 23:00.

	// Walk backwards from the last band's end time:
	// each previous band ends `changeOver` minutes before the next starts.
	const schedule = new Array(n);

	let nextStart = endTime;

	for (let i = n - 1; i >= 0; i--) {
		const duration = Number(bands[i].duration) || 0;
		const start = nextStart - duration;

		schedule[i] = {
			start: formatTime(start),
			end: formatTime(nextStart)
		};

		nextStart = start - changeOver;
	}

	return schedule;
}

function renderSoundcheck() {
	soundcheckList.innerHTML = "";

	const n = bands.length;
	if (n === 0) {
		return;
	}

	const start = 18 * 60; // 18:00
	const end = 20 * 60; // 20:00
	const slotLength = (end - start) / n;

	soundcheckOrder.forEach((bandIndex, index) => {
		const band = bands[bandIndex];

		const item = document.createElement("div");
		item.className = "order-item";

		const slotStart = start + index * slotLength;
		const slotEnd = slotStart + slotLength;

		const title = document.createElement("span");
		title.textContent = `${formatTime(slotStart)}–${formatTime(slotEnd)} ${band.name || `Band ${bandIndex + 1}`}`;

		const controls = document.createElement("div");
		controls.className = "order-controls";

		const upButton = document.createElement("button");
		upButton.type = "button";
		upButton.textContent = "↑";
		upButton.disabled = index === 0 || index === n - 1;

		const downButton = document.createElement("button");
		downButton.type = "button";
		downButton.textContent = "↓";
		downButton.disabled = index >= n - 2;

		upButton.addEventListener("click", () => moveSoundcheck(index, -1));
		downButton.addEventListener("click", () => moveSoundcheck(index, 1));

		controls.appendChild(upButton);
		controls.appendChild(downButton);

		item.appendChild(title);
		item.appendChild(controls);

		soundcheckList.appendChild(item);
	});
}

function updateChangeOver(delta) {
	changeOver = Math.min(60, Math.max(10, changeOver + delta));
	changeoverValue.textContent = changeOver;
	renderOrder();
}

changeoverMinus.addEventListener("click", () => updateChangeOver(-5));
changeoverPlus.addEventListener("click", () => updateChangeOver(5));

function formatTime(minutes) {
	const hours = Math.floor(minutes / 60);
	const mins = Math.round(minutes % 60);

	return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function renderOrder() {
	orderList.innerHTML = "";

	const schedule = computeSchedule();

	bands.forEach((band, index) => {
		const item = document.createElement("div");
		item.className = "order-item";

		const title = document.createElement("span");
		title.textContent = `${schedule[index].start}–${schedule[index].end} ${band.name || `Band ${index + 1}`}`;

		const controls = document.createElement("div");
		controls.className = "order-controls";

		const upButton = document.createElement("button");
		upButton.type = "button";
		upButton.textContent = "↑";
		upButton.disabled = index === 0;

		const downButton = document.createElement("button");
		downButton.type = "button";
		downButton.textContent = "↓";
		downButton.disabled = index === bands.length - 1;

		upButton.addEventListener("click", () => moveBand(index, -1));
		downButton.addEventListener("click", () => moveBand(index, 1));

		controls.appendChild(upButton);
		controls.appendChild(downButton);

		item.appendChild(title);
		item.appendChild(controls);

		orderList.appendChild(item);
	});
}

// ============================================================
// Soundcheck order management
// ============================================================

function moveSoundcheck(index, direction) {
	const newIndex = index + direction;
	const lastIndex = soundcheckOrder.length - 1;

	// The last slot is reserved for the first performing band.
	if (index === lastIndex || newIndex < 0 || newIndex >= lastIndex) {
		return;
	}

	const temp = soundcheckOrder[index];
	soundcheckOrder[index] = soundcheckOrder[newIndex];
	soundcheckOrder[newIndex] = temp;

	renderSoundcheck();
}

// ============================================================
// Order management
// ============================================================

function updateBand(event) {
	const input = event.target;
	const index = Number(input.dataset.index);
	const field = input.dataset.field;

	if (input.type === "checkbox") {
		bands[index][field] = input.checked;
	} else {
		bands[index][field] = input.value;
	}

	if (field === "name" || field === "duration") {
		renderOrder();
		renderSoundcheck();
	}
}

function moveBand(index, direction) {
	const newIndex = index + direction;

	if (newIndex < 0 || newIndex >= bands.length) {
		return;
	}

	const temp = bands[index];
	bands[index] = bands[newIndex];
	bands[newIndex] = temp;

	// Keep the soundcheck order attached to the bands themselves.
	soundcheckOrder = soundcheckOrder.map(
		i => (i === index ? newIndex : i === newIndex ? index : i)
	);

	// The first performing band must always check sound last.
	const firstPos = soundcheckOrder.indexOf(0);
	if (firstPos !== -1 && firstPos !== soundcheckOrder.length - 1) {
		soundcheckOrder.splice(firstPos, 1);
		soundcheckOrder.push(0);
	}

	renderBands();
	renderOrder();
	renderSoundcheck();
}

// ============================================================
// Save to Google Apps Script
// ============================================================

eventForm.addEventListener("submit", async event => {
	event.preventDefault();

	saveButton.disabled = true;
	status.textContent = "Saving...";

	const schedule = computeSchedule();
	const soundcheckSchedule = computeSoundcheckSchedule();

	const data = {
		date: document.getElementById("date").value,
		organizer: document.getElementById("organizer").value,
		bands: bands.map((band, index) => ({
			...band,
			slotStart: schedule[index].start,
			slotEnd: schedule[index].end,
			soundcheckStart: soundcheckSchedule[index].start,
			soundcheckEnd: soundcheckSchedule[index].end
		}))
	};

	try {
		const response = await fetch(GOOGLE_SCRIPT_URL, {
			method: "POST",
			body: JSON.stringify(data)
		});

		const responseData = await response.json();

		if (!responseData.ok) {
			throw new Error(responseData.error || "Save error");
		}

		resultText.value = responseData.text;
		result.classList.remove("hidden");

		status.textContent = "Saved";
	} catch (error) {
		console.error(error);
		status.textContent = "Error: " + error.message;
	} finally {
		saveButton.disabled = false;
	}
});

// ============================================================
// Copy result to clipboard
// ============================================================

copyButton.addEventListener("click", async () => {
	await navigator.clipboard.writeText(resultText.value);

	const oldText = copyButton.textContent;
	copyButton.textContent = "Copied";

	setTimeout(() => {
		copyButton.textContent = oldText;
	}, 1500);
});

// ============================================================
// Utilities
// ============================================================

function escapeHtml(value) {
	const map = {
		"&": "\u0026amp;",
		"<": "\u0026lt;",
		">": "\u0026gt;",
		'"': "\u0026quot;",
		"'": "\u0026#039;"
	};

	return String(value).replace(/[&<>"']/g, char => map[char]);
}

// ============================================================
// Prefill from calendar view ("Edit" button)
// ============================================================

function prefillFromEditEvent() {
	const raw = sessionStorage.getItem("editEvent");

	if (!raw) {
		return;
	}

	sessionStorage.removeItem("editEvent");

	let event;

	try {
		event = JSON.parse(raw);
	} catch {
		return;
	}

	if (!event || !Array.isArray(event.bands)) {
		return;
	}

	document.getElementById("date").value = event.date || "";
	document.getElementById("organizer").value = event.organizer || "";
	bandCountInput.value = Math.max(1, event.bands.length);

	bands = event.bands.map(band => ({
		name: band.name || "",
		members: band.members ?? "",
		drums: Boolean(band.drums),
		guitarAmps: band.guitarAmps ?? 0,
		vocalMics: band.vocalMics ?? 0,
		duration: band.duration || "",
		notes: band.notes || "",
		slotStart: band.slotStart || "",
		slotEnd: band.slotEnd || "",
		soundcheckStart: band.soundcheckStart || "",
		soundcheckEnd: band.soundcheckEnd || ""
	}));

	// Restore change-over from the gap between the first band's
	// slotEnd and the second band's slotStart; clamp to 10–60.
	if (bands.length >= 2 && bands[0].slotEnd && bands[1].slotStart) {
		const toMinutes = time => {
			const [h, m] = time.split(":").map(Number);
			return h * 60 + m;
		};

		const gap = toMinutes(bands[1].slotStart) - toMinutes(bands[0].slotEnd);

		if (Number.isFinite(gap)) {
			changeOver = Math.min(60, Math.max(10, Math.round(gap / 5) * 5));
			changeoverValue.textContent = changeOver;
		}
	}

	// Restore the saved soundcheck order; fall back to the
	// default rotation for events saved before it was stored.
	if (bands.every(band => band.soundcheckStart && band.soundcheckEnd)) {
		soundcheckOrder = bands
			.map((band, index) => ({ index, start: band.soundcheckStart }))
			.sort((a, b) => a.start.localeCompare(b.start))
			.map(item => item.index);
	} else {
		rebuildSoundcheckOrder();
	}

	renderBands();
	renderOrder();
	renderSoundcheck();

	status.textContent = "Editing existing event";
}

updateBandCount();
prefillFromEditEvent();
