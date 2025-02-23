/******************************************************
 * script.js - Raffle Tracker with:
 *  - Inline Editing for Graduations & Integrations
 *  - 150-Yard Football Field
 *  - CSV Import/Export + Template
 *  - Reset All
 *  - Manual Adjust for Entries ONLY, with Pin Code (0220)
 ******************************************************/

// DOM Elements
const addGraduationsBtn   = document.getElementById("addGraduationsBtn");
const addIntegrationsBtn  = document.getElementById("addIntegrationsBtn");
const showFieldViewBtn    = document.getElementById("showFieldViewBtn");
const displayStatsBtn     = document.getElementById("displayStatsBtn");
const manualAdjustBtn     = document.getElementById("manualAdjustBtn");
const resetAllBtn         = document.getElementById("resetAllBtn");

const downloadCsvBtn      = document.getElementById("downloadCsvBtn");
const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
const importCsvBtn        = document.getElementById("importCsvBtn");
const csvImportInput      = document.getElementById("csvImportInput");

const statsTable          = document.getElementById("statsTable");
const statsTableBody      = statsTable.querySelector("tbody");
const fieldContainer      = document.querySelector(".field-container");
const footballCanvas      = document.getElementById("footballField");
const ctx                 = footballCanvas.getContext("2d");

// Preload your football icon
const footballImg = new Image();
footballImg.src = "football_icon.png"; // Ensure this file is in /public

// ---------- Fetch & POST Helpers ----------
async function fetchManagersData() {
  const res = await fetch("/api/managers");
  if (!res.ok) {
    throw new Error("Failed to fetch managers data");
  }
  return res.json();
}

async function postData(url, bodyObj) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj)
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Unknown error");
  }
  return res.json();
}

// ============================================================
// Display Stats (with Inline Editing for Graduations & Integrations)
// ============================================================
async function displayCurrentStats() {
  fieldContainer.classList.add("hidden");
  statsTable.classList.remove("hidden");

  try {
    const managers = await fetchManagersData();
    statsTableBody.innerHTML = "";

    managers.forEach(m => {
      const tr = document.createElement("tr");

      // Manager Name
      const tdName = document.createElement("td");
      tdName.textContent = m.name;
      tdName.dataset.managerName = m.name;
      tr.appendChild(tdName);

      // Graduations (double-click to edit)
      const tdGrads = document.createElement("td");
      tdGrads.textContent = m.graduations;
      tdGrads.dataset.managerName = m.name;
      tdGrads.dataset.field = "graduations"; 
      tdGrads.ondblclick = handleCellDblClick;
      tr.appendChild(tdGrads);

      // Integrations (double-click to edit)
      const tdInts = document.createElement("td");
      tdInts.textContent = m.integrations;
      tdInts.dataset.managerName = m.name;
      tdInts.dataset.field = "integrations";
      tdInts.ondblclick = handleCellDblClick;
      tr.appendChild(tdInts);

      // Entries (read-only here; can override via Manual Adjust + Pin)
      const tdEntries = document.createElement("td");
      tdEntries.textContent = m.entries;
      tr.appendChild(tdEntries);

      statsTableBody.appendChild(tr);
    });
  } catch (error) {
    alert("Error displaying stats: " + error.message);
  }
}

/**
 * Double-click editing logic for Graduations & Integrations
 */
function handleCellDblClick(e) {
  const cell = e.target;
  const managerName = cell.dataset.managerName;
  const field = cell.dataset.field; // "graduations" or "integrations"
  const oldValue = cell.textContent;

  // Create input
  const input = document.createElement("input");
  input.type = "number";
  input.value = oldValue;
  input.style.width = "80px";

  cell.textContent = "";
  cell.appendChild(input);
  input.focus();

  input.onblur = () => finalizeCellEdit(managerName, field, cell, input, oldValue);
  input.onkeydown = (evt) => {
    if (evt.key === "Enter") {
      finalizeCellEdit(managerName, field, cell, input, oldValue);
    }
  };
}

async function finalizeCellEdit(managerName, field, cell, input, oldValue) {
  const newValueStr = input.value.trim();
  const newValue = parseInt(newValueStr, 10);

  if (isNaN(newValue) || newValue < 0) {
    alert("Invalid numeric value.");
    cell.removeChild(input);
    cell.textContent = oldValue; 
    return;
  }

  try {
    const encodedName = encodeURIComponent(managerName);
    await postData(`/api/managers/${encodedName}/set`, {
      field,
      newValue
    });
  } catch (error) {
    alert("Error updating value: " + error.message);
  }

  displayCurrentStats();
}

// ============================================================
// The "WAY COOLER" Field at 150 yards (line every 10 yards)
// ============================================================
async function showFootballField() {
  statsTable.classList.add("hidden");
  fieldContainer.classList.remove("hidden");

  ctx.clearRect(0, 0, footballCanvas.width, footballCanvas.height);

  try {
    const managers = await fetchManagersData();

    const MAX_YARDS = 150;
    const YARD_INCREMENT = 10;

    // clamp entries above 150
    const managerEntries = managers.map(m => {
      const e = (m.entries > MAX_YARDS) ? MAX_YARDS : m.entries;
      return { name: m.name, entries: e };
    });

    // wait for football icon
    await new Promise(resolve => {
      if (footballImg.complete) resolve();
      else footballImg.onload = resolve;
    });

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.font = "20px Arial";
    ctx.fillStyle = "#ffffff";

    for (let yard = 0; yard <= MAX_YARDS; yard += YARD_INCREMENT) {
      const xPos = (yard / MAX_YARDS) * footballCanvas.width;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, footballCanvas.height);
      ctx.stroke();
      ctx.fillText(String(yard), xPos + 5, 30);
    }

    // sparkles
    for (let i = 0; i < 30; i++) {
      const sx = Math.random() * footballCanvas.width;
      const sy = Math.random() * footballCanvas.height;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";

    const rowHeight = footballCanvas.height / (managerEntries.length + 1);
    managerEntries.forEach((mgr, i) => {
      const ratio = mgr.entries / MAX_YARDS;
      const xPos = ratio * footballCanvas.width;
      const yPos = rowHeight * (i + 1);

      const iconW = 28;
      const iconH = 16;
      ctx.drawImage(footballImg, xPos - iconW / 2, yPos - iconH / 2, iconW, iconH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.fillText(`${mgr.name} (${mgr.entries})`, xPos + 10, yPos - 5);
    });
  } catch (error) {
    alert("Error showing field: " + error.message);
  }
}

// ============================================================
// Add Graduations / Integrations
// ============================================================
async function addGraduations() {
  const name = prompt("Enter manager's name EXACTLY:");
  if (!name) return;

  const qStr = prompt("How many Graduations to add?");
  const quantity = parseInt(qStr, 10);
  if (isNaN(quantity) || quantity < 0) {
    alert("Invalid quantity.");
    return;
  }

  try {
    const data = await postData(`/api/managers/${encodeURIComponent(name)}/graduations`, { quantity });
    alert(data.message);
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function addIntegrations() {
  const name = prompt("Enter manager's name EXACTLY:");
  if (!name) return;

  const qStr = prompt("How many Integrations to add?");
  const quantity = parseInt(qStr, 10);
  if (isNaN(quantity) || quantity < 0) {
    alert("Invalid quantity.");
    return;
  }

  try {
    const data = await postData(`/api/managers/${encodeURIComponent(name)}/integrations`, { quantity });
    alert(data.message);
  } catch (error) {
    alert("Error: " + error.message);
  }
}

// ============================================================
// Manual Adjust: ENTRIES ONLY + Pin Check (0220)
// ============================================================
async function manualAdjust() {
  const name = prompt("Enter manager's name EXACTLY:");
  if (!name) return;

  // Pin code check
  const pin = prompt("Please enter the Manager's PIN code:");
  if (pin !== "0220") {
    alert("Invalid PIN. You cannot override entries.");
    return;
  }

  // Now we only adjust "entries"
  const valStr = prompt("Enter new value for entries:");
  const newValue = parseInt(valStr, 10);
  if (isNaN(newValue) || newValue < 0) {
    alert("Invalid value.");
    return;
  }

  try {
    // /api/managers/:name/set => field: "entries"
    const result = await postData(`/api/managers/${encodeURIComponent(name)}/set`, {
      field: "entries",
      newValue
    });
    alert(result.message);
  } catch (error) {
    alert("Error: " + error.message);
  }
}

// ============================================================
// Reset All
// ============================================================
async function resetAllData() {
  if (!confirm("Are you sure you want to RESET all data to zero?")) return;

  try {
    const data = await postData("/api/reset", {});
    alert(data.message);
    displayCurrentStats();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

// ============================================================
// Export to CSV
// ============================================================
async function downloadCsv() {
  try {
    const managers = await fetchManagersData();
    let csv = "Name,Graduations,Integrations,Entries\n";
    managers.forEach(m => {
      csv += `"${m.name}",${m.graduations},${m.integrations},${m.entries}\n`;
    });
    downloadFile(csv, "managers_export.csv", "text/csv");
  } catch (error) {
    alert("Error exporting CSV: " + error.message);
  }
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// Download Template CSV
// ============================================================
function downloadTemplateCsv() {
  fetchManagersData().then(managers => {
    let csv = "Name,Graduations,Integrations\n";
    managers.forEach(m => {
      csv += `"${m.name}",0,0\n`;
    });
    downloadFile(csv, "template.csv", "text/csv");
  }).catch(err => {
    alert("Error generating template CSV: " + err.message);
  });
}

// ============================================================
// Import CSV
// ============================================================
function handleImportCsv() {
  csvImportInput.click();
}

function handleCsvFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  csvImportInput.value = ""; 
  const reader = new FileReader();
  reader.onload = async (evt) => {
    const text = evt.target.result;
    try {
      await processImportedCsv(text);
      alert("CSV Imported Successfully!");
      displayCurrentStats();
    } catch (err) {
      alert("Error importing CSV: " + err.message);
    }
  };
  reader.readAsText(file);
}

async function processImportedCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSV has no data rows");
  }

  const header = lines[0].split(",");
  if (header.length < 3) {
    throw new Error("CSV must have columns: Name,Graduations,Integrations");
  }
  const nameIdx = header.indexOf("Name");
  const gradsIdx = header.indexOf("Graduations");
  const intsIdx  = header.indexOf("Integrations");
  if (nameIdx === -1 || gradsIdx === -1 || intsIdx === -1) {
    throw new Error("CSV must have columns: Name,Graduations,Integrations");
  }

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    if (row.length < 3) {
      console.warn("Skipping malformed line:", lines[i]);
      continue;
    }
    const mgrName = row[nameIdx].replace(/^"|"$/g, "").trim();
    const gradsStr = row[gradsIdx].trim();
    const intsStr  = row[intsIdx].trim();

    const gVal = parseInt(gradsStr, 10);
    const iVal = parseInt(intsStr, 10);
    if (!mgrName || isNaN(gVal) || gVal < 0 || isNaN(iVal) || iVal < 0) {
      console.warn("Skipping invalid row:", lines[i]);
      continue;
    }

    // Post to /set for graduations & integrations
    await postData(`/api/managers/${encodeURIComponent(mgrName)}/set`, {
      field: "graduations",
      newValue: gVal
    });
    await postData(`/api/managers/${encodeURIComponent(mgrName)}/set`, {
      field: "integrations",
      newValue: iVal
    });
  }
}

// ---------- Attach Event Listeners ----------
addGraduationsBtn.addEventListener("click", addGraduations);
addIntegrationsBtn.addEventListener("click", addIntegrations);
showFieldViewBtn.addEventListener("click", showFootballField);
displayStatsBtn.addEventListener("click", displayCurrentStats);
manualAdjustBtn.addEventListener("click", manualAdjust);
resetAllBtn.addEventListener("click", resetAllData);

downloadCsvBtn.addEventListener("click", downloadCsv);
downloadTemplateBtn.addEventListener("click", downloadTemplateCsv);
importCsvBtn.addEventListener("click", handleImportCsv);
csvImportInput.addEventListener("change", handleCsvFileSelected);

// Show stats on load
displayCurrentStats();
