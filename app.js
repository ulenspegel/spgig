// ============================================================
// Band lineup form — app.js
// ============================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzVukzuYP5HSMVrRGOo3UluWlXCL2iDfxuWnzI9CRIm0_GzS8F-k4lZQ5spuLAn-aziwA/exec";

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

let bands = [];

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

	renderBands();
	renderOrder();
	renderSoundcheck();
}

// ============================================================
// Rendering
// ============================================================

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
					Duration, minutes
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
					Guitar amps
					<input
						type="number"
						min="0"
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
				Has drums
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
	const totalPerf = bands.reduce(
		(sum, band) => sum + (Number(band.duration) || 0),
		0
	);
	const changeTime = (n - 1) * 10;
	const isLongSet = totalPerf + changeTime > 120;
	const totalLength = isLongSet ? 150 : 120;

	// Leftover time is split into n-1 gaps between bands,
	// rounded down to multiples of 5 minutes (min 10 min),
	// then the remainder is spread one extra 5 min at a time.
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

function renderSoundcheck() {
	soundcheckList.innerHTML = "";

	const n = bands.length;
	if (n === 0) {
		return;
	}

	const start = 18 * 60; // 18:00
	const end = 20 * 60; // 20:00
	const slotLength = (end - start) / n;

	// Soundcheck order: bands 2..n first (in performance order),
	// the first performing band checks sound last.
	const rotated = [...bands.slice(1), bands[0]];

	rotated.forEach((band, index) => {
		const item = document.createElement("div");
		item.className = "order-item";

		const slotStart = start + index * slotLength;
		const slotEnd = slotStart + slotLength;

		const title = document.createElement("span");
		title.textContent = `${formatTime(slotStart)}–${formatTime(slotEnd)} ${band.name || `Band ${bands.indexOf(band) + 1}`}`;

		item.appendChild(title);
		soundcheckList.appendChild(item);
	});
}

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

	const data = {
		date: document.getElementById("date").value,
		organizer: document.getElementById("organizer").value,
		bands: bands.map((band, index) => ({
			...band,
			slotStart: schedule[index].start,
			slotEnd: schedule[index].end
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

/*
 * Insert the published Google Apps Script URL here.
 */

updateBandCount();