const board = document.getElementById("board");
const addNoteBtn = document.getElementById("addNote");
const connectModeBtn = document.getElementById("connectMode");
const searchBtn = document.getElementById("search");
const formatToolbar = document.getElementById("formatToolbar");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const strikeBtn = document.getElementById("strikeBtn");

let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let selectedNote = null;
let activeTextArea = null;

// Connection related variables
let isConnectionMode = false;
let startConnectionPoint = null;
let connections = [];

// Store offsets for each note
const noteOffsets = new WeakMap();

const noteColors = ["#FFB3BA", "#BAFFC9", "#BAE1FF", "#FFFFBA"];

function createNote(
  x,
  y,
  color = noteColors[Math.floor(Math.random() * noteColors.length)]
) {
  const note = document.createElement("div");
  note.className = "note";
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;
  note.style.backgroundColor = color;

  // Initialize offset for this note
  noteOffsets.set(note, { x: x, y: y });

  // Add header for dragging
  const header = document.createElement("div");
  header.className = "note-header";
  note.appendChild(header);

  const textarea = document.createElement("div");
  textarea.className = "note-content";
  textarea.contentEditable = true;
  textarea.setAttribute("placeholder", "Write your note here...");
  textarea.addEventListener("focus", handleTextAreaFocus);
  textarea.addEventListener("blur", handleTextAreaBlur);
  textarea.addEventListener("mouseup", updateFormatToolbarPosition);
  textarea.addEventListener("keyup", updateFormatToolbarPosition);
  note.appendChild(textarea);

  // Add connection point at the pin
  const connectionPoint = document.createElement("div");
  connectionPoint.className = "connection-point";
  connectionPoint.style.right = "15px";
  connectionPoint.style.top = "4px";
  connectionPoint.addEventListener("click", handleConnectionPointClick);
  note.appendChild(connectionPoint);

  board.appendChild(note);

  // Add drag functionality only for mousedown
  header.addEventListener("mousedown", dragStart);

  return note;
}

function handleTextAreaFocus(e) {
  activeTextArea = e.target;
  updateFormatToolbarPosition();
}

function handleTextAreaBlur(e) {
  // Small delay to allow button clicks to register
  setTimeout(() => {
    if (!formatToolbar.contains(document.activeElement)) {
      formatToolbar.classList.remove("visible");
      activeTextArea = null;
    }
  }, 100);
}

function updateFormatToolbarPosition() {
  if (!activeTextArea) return;

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0) {
    // No text selected, position toolbar at cursor
    const textRect = activeTextArea.getBoundingClientRect();
    formatToolbar.style.top = `${textRect.top - 40}px`;
    formatToolbar.style.left = `${textRect.left}px`;
  } else {
    // Position toolbar above selection
    formatToolbar.style.top = `${rect.top - 40}px`;
    formatToolbar.style.left = `${
      rect.left + (rect.width - formatToolbar.offsetWidth) / 2
    }px`;
  }

  formatToolbar.classList.add("visible");
  updateFormatButtonStates();
}

function updateFormatButtonStates() {
  boldBtn.classList.toggle("active", document.queryCommandState("bold"));
  italicBtn.classList.toggle("active", document.queryCommandState("italic"));
  underlineBtn.classList.toggle(
    "active",
    document.queryCommandState("underline")
  );
  strikeBtn.classList.toggle(
    "active",
    document.queryCommandState("strikethrough")
  );
}

function formatText(command) {
  document.execCommand(command, false, null);
  updateFormatButtonStates();
}

// Format button event listeners
boldBtn.addEventListener("click", () => formatText("bold"));
italicBtn.addEventListener("click", () => formatText("italic"));
underlineBtn.addEventListener("click", () => formatText("underline"));
strikeBtn.addEventListener("click", () => formatText("strikethrough"));

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (!activeTextArea) return;

  if (e.ctrlKey) {
    switch (e.key.toLowerCase()) {
      case "b":
        e.preventDefault();
        formatText("bold");
        break;
      case "i":
        e.preventDefault();
        formatText("italic");
        break;
      case "u":
        e.preventDefault();
        formatText("underline");
        break;
      case "s":
        e.preventDefault();
        formatText("strikethrough");
        break;
    }
  }
});

function handleConnectionPointClick(e) {
  if (!isConnectionMode) return;

  const connectionPoint = e.target;
  const note = connectionPoint.closest(".note");

  if (!startConnectionPoint) {
    // Start connection
    startConnectionPoint = {
      element: connectionPoint,
      note: note,
      position: connectionPoint.dataset.position,
    };
    connectionPoint.style.backgroundColor = "#00ff00";
  } else if (startConnectionPoint.note !== note) {
    // Complete connection
    createConnection(startConnectionPoint, {
      element: connectionPoint,
      note: note,
      position: connectionPoint.dataset.position,
    });

    // Reset start point
    startConnectionPoint.element.style.backgroundColor = "#ff4444";
    startConnectionPoint = null;
  }
}

function createConnection(start, end) {
  const connection = document.createElement("div");
  connection.className = "connection-line";

  // Create SVG element
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";

  // Create path element
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", "url(#string-gradient)");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("fill", "none");

  // Add gradient definition
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const gradient = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "linearGradient"
  );
  gradient.id = "string-gradient";
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.innerHTML = `
    <stop offset="0%" stop-color="#cc0000" />
    <stop offset="50%" stop-color="#ff4444" />
    <stop offset="100%" stop-color="#cc0000" />
  `;
  defs.appendChild(gradient);
  svg.appendChild(defs);
  svg.appendChild(path);

  connection.appendChild(svg);
  board.appendChild(connection);

  connections.push({
    element: connection,
    path: path,
    start: start,
    end: end,
  });

  updateConnection(connections[connections.length - 1]);
}

function updateConnection(connection) {
  const startRect = connection.start.element.getBoundingClientRect();
  const endRect = connection.end.element.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();

  // Calculate positions relative to the board
  const startX = startRect.left + startRect.width / 2 - boardRect.left;
  const startY = startRect.top + startRect.height / 2 - boardRect.top;
  const endX = endRect.left + endRect.width / 2 - boardRect.left;
  const endY = endRect.top + endRect.height / 2 - boardRect.top;

  // Calculate the distance and direction
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Calculate control points for the curve
  // The amount of sag increases with distance
  const sagAmount = Math.min(distance * 0.2, 50);
  const midX = (startX + endX) / 2;
  const midY = Math.max(startY, endY) + sagAmount;

  // Create the path
  const pathData = `
    M ${startX} ${startY}
    Q ${midX} ${midY} ${endX} ${endY}
  `;

  // Update SVG container size and position
  const svg = connection.path.ownerSVGElement;
  svg.style.width = `${boardRect.width}px`;
  svg.style.height = `${boardRect.height}px`;

  // Update the path
  connection.path.setAttribute("d", pathData);

  // Position the connection div (needed for z-index)
  connection.element.style.width = `${boardRect.width}px`;
  connection.element.style.height = `${boardRect.height}px`;
  connection.element.style.left = "0px";
  connection.element.style.top = "0px";
}

function updateAllConnections() {
  connections.forEach(updateConnection);
}

function dragStart(e) {
  if (e.target.className !== "note-header") return;

  selectedNote = e.target.closest(".note");
  if (!selectedNote) return;

  const offset = noteOffsets.get(selectedNote);
  initialX = e.clientX - offset.x;
  initialY = e.clientY - offset.y;

  isDragging = true;

  // Prevent text selection during drag
  e.preventDefault();
}

// Move mousemove and mouseup listeners to window level
window.addEventListener("mousemove", (e) => {
  if (!isDragging || !selectedNote) return;

  e.preventDefault();
  currentX = e.clientX - initialX;
  currentY = e.clientY - initialY;

  // Update the offset for this specific note
  noteOffsets.set(selectedNote, { x: currentX, y: currentY });

  setTranslate(currentX, currentY, selectedNote);
  updateAllConnections();
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  selectedNote = null;
});

function setTranslate(xPos, yPos, el) {
  el.style.left = `${xPos}px`;
  el.style.top = `${yPos}px`;
}

// Event Listeners
addNoteBtn.addEventListener("click", () => {
  const x = Math.random() * (window.innerWidth - 250);
  const y = Math.random() * (window.innerHeight - 250);
  createNote(x, y);
});

connectModeBtn.addEventListener("click", () => {
  isConnectionMode = !isConnectionMode;
  connectModeBtn.classList.toggle("active");
  board.classList.toggle("connection-mode");

  if (!isConnectionMode && startConnectionPoint) {
    startConnectionPoint.element.style.backgroundColor = "#ff4444";
    startConnectionPoint = null;
  }
});

// Handle file drag and drop
board.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

board.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement("img");
        img.src = event.target.result;
        img.style.maxWidth = "180px";
        img.style.maxHeight = "180px";

        const note = createNote(e.clientX - 100, e.clientY - 100);
        note.querySelector(".note-content").appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  }
});
