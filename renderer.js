const { ipcRenderer } = require("electron");
const board = document.getElementById("board");
const addNoteBtn = document.getElementById("addNote");
const connectModeBtn = document.getElementById("connectMode");
const searchBtn = document.getElementById("search");
const saveBoardBtn = document.getElementById("saveBoard");
const returnHomeBtn = document.getElementById("returnHome");
const formatToolbar = document.getElementById("formatToolbar");
const stringTypesMenu = document.getElementById("stringTypesMenu");
const connectionMenu = document.getElementById("connectionMenu");
const noteMenu = document.getElementById("noteMenu");
const boldBtn = document.getElementById("boldBtn");
const italicBtn = document.getElementById("italicBtn");
const underlineBtn = document.getElementById("underlineBtn");
const strikeBtn = document.getElementById("strikeBtn");

// Add board name modal elements
const boardNameModal = document.getElementById("boardNameModal");
const boardNameInput = document.getElementById("boardNameInput");
const saveBoardNameBtn = document.getElementById("saveBoardName");
const cancelBoardNameBtn = document.getElementById("cancelBoardName");

let boardName = null;

// Initialize theme
async function initializeTheme() {
  const theme = await ipcRenderer.invoke("get-theme");
  document.documentElement.dataset.theme = theme;
}

// Initialize theme on load
initializeTheme();

// Get board ID from URL if it exists
const urlParams = new URLSearchParams(window.location.search);
const boardId = urlParams.get("id");

// Load board data if editing existing board
if (boardId) {
  ipcRenderer.invoke("get-saved-boards").then((savedBoards) => {
    const boardData = savedBoards.find((board) => board.id === boardId);
    if (boardData) {
      loadBoardData(boardData);
    }
  });
}

function loadBoardData(boardData) {
  // Store board name
  boardName = boardData.name;

  // Clear existing board
  board.innerHTML = "";
  connections = [];

  // Create a map to store note elements by their IDs
  const noteElements = new Map();

  // Recreate notes
  boardData.notes.forEach((noteData) => {
    const note = createNote(noteData.x, noteData.y, noteData.color);
    note.dataset.id = noteData.id;
    note.querySelector(".note-content").innerHTML = noteData.content;
    noteElements.set(noteData.id, note);
  });

  // Recreate connections
  boardData.connections.forEach((connData) => {
    const startNote = noteElements.get(connData.startNoteId);
    const endNote = noteElements.get(connData.endNoteId);

    if (startNote && endNote) {
      const startPoint = startNote.querySelector(".connection-point");
      const endPoint = endNote.querySelector(".connection-point");

      currentStringType = connData.type;
      createConnection(
        { element: startPoint, note: startNote },
        { element: endPoint, note: endNote }
      );
    }
  });
}

function saveBoardData() {
  const notes = Array.from(document.querySelectorAll(".note")).map((note) => ({
    id: note.dataset.id || Date.now().toString(),
    x: parseInt(note.style.left),
    y: parseInt(note.style.top),
    color: note.style.backgroundColor,
    content: note.querySelector(".note-content").innerHTML,
  }));

  const connectionData = connections.map((conn) => ({
    startNoteId: conn.start.note.dataset.id,
    endNoteId: conn.end.note.dataset.id,
    type: conn.type,
  }));

  const boardData = {
    id: boardId || Date.now().toString(),
    name: boardName || `Board ${new Date().toLocaleDateString()}`,
    notes,
    connections: connectionData,
  };

  ipcRenderer.send("save-board", boardData);
}

// Event listeners for save and return
saveBoardBtn.addEventListener("click", () => {
  if (!boardId && !boardName) {
    // First time saving, show modal
    boardNameModal.classList.add("visible");
    boardNameInput.focus();
  } else {
    saveBoardData();
    showNotification("Board saved successfully!");
  }
});

// Handle board name modal
saveBoardNameBtn.addEventListener("click", () => {
  const name = boardNameInput.value.trim();
  if (name) {
    boardName = name;
    boardNameModal.classList.remove("visible");
    saveBoardData();
    showNotification("Board saved successfully!");
  } else {
    boardNameInput.classList.add("error");
  }
});

cancelBoardNameBtn.addEventListener("click", () => {
  boardNameModal.classList.remove("visible");
  boardNameInput.value = "";
});

// Handle board saved response
ipcRenderer.on("board-saved", (event, savedBoardId) => {
  boardId = savedBoardId;
});

returnHomeBtn.addEventListener("click", () => {
  ipcRenderer.send("return-to-home");
});

let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let draggedNote = null; // For dragging
let selectedNote = null; // For context menu
let activeTextArea = null;
let currentStringType = "solid";
let selectedConnection = null;

// Connection related variables
let isConnectionMode = false;
let startConnectionPoint = null;
let connections = [];

// Store offsets for each note
const noteOffsets = new WeakMap();

// Define note colors
const noteColors = [
  "#FFB3BA", // Pastel Pink
  "#BAFFC9", // Pastel Green
  "#BAE1FF", // Pastel Blue
  "#FFFFBA", // Pastel Yellow
  "#FFB5E8", // Pastel Magenta
  "#B5B9FF", // Pastel Purple
  "#97E1D4", // Pastel Turquoise
  "#F6CC79", // Pastel Orange
];

function createNote(
  x,
  y,
  color = noteColors[Math.floor(Math.random() * noteColors.length)]
) {
  const note = document.createElement("div");
  note.className = "note";
  note.dataset.id = Date.now().toString();
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

// Add string type selection handlers
document.querySelectorAll(".string-type-option").forEach((option) => {
  option.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent document click handler
    // Update active state
    document
      .querySelectorAll(".string-type-option")
      .forEach((opt) => opt.classList.remove("active"));
    option.classList.add("active");

    // Update current string type
    currentStringType = option.dataset.type;
  });
});

// Update connect mode button to show/hide string types menu
connectModeBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent document click handler
  isConnectionMode = !isConnectionMode;
  connectModeBtn.classList.toggle("active");
  board.classList.toggle("connection-mode");
  stringTypesMenu.classList.toggle("visible");

  if (!isConnectionMode && startConnectionPoint) {
    startConnectionPoint.element.style.backgroundColor = "#ff4444";
    startConnectionPoint = null;
  }
});

// Hide string types menu when clicking outside
document.addEventListener("click", (e) => {
  if (!isConnectionMode) return;

  const isClickInside =
    stringTypesMenu.contains(e.target) ||
    connectModeBtn.contains(e.target) ||
    e.target.classList.contains("connection-point");

  if (!isClickInside) {
    stringTypesMenu.classList.remove("visible");
    isConnectionMode = false;
    connectModeBtn.classList.remove("active");
    board.classList.remove("connection-mode");

    if (startConnectionPoint) {
      startConnectionPoint.element.style.backgroundColor = "#ff4444";
      startConnectionPoint = null;
    }
  }
});

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
    // Check if connection already exists between these notes
    const existingConnection = connections.find(
      (conn) =>
        (conn.start.note === startConnectionPoint.note &&
          conn.end.note === note) ||
        (conn.start.note === note &&
          conn.end.note === startConnectionPoint.note)
    );

    if (existingConnection) {
      // Update existing connection type
      existingConnection.element.className = `connection-line ${currentStringType}`;
      existingConnection.type = currentStringType;
    } else {
      // Create new connection
      createConnection(startConnectionPoint, {
        element: connectionPoint,
        note: note,
        position: connectionPoint.dataset.position,
      });
    }

    // Reset start point
    startConnectionPoint.element.style.backgroundColor = "#ff4444";
    startConnectionPoint = null;
  }
}

function createConnection(start, end) {
  const connection = document.createElement("div");
  connection.className = `connection-line ${currentStringType}`;

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
    type: currentStringType,
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

  draggedNote = e.target.closest(".note");
  if (!draggedNote) return;

  const offset = noteOffsets.get(draggedNote);
  initialX = e.clientX - offset.x;
  initialY = e.clientY - offset.y;

  isDragging = true;

  // Prevent text selection during drag
  e.preventDefault();
}

// Move mousemove and mouseup listeners to window level
window.addEventListener("mousemove", (e) => {
  if (!isDragging || !draggedNote) return;

  e.preventDefault();
  currentX = e.clientX - initialX;
  currentY = e.clientY - initialY;

  // Update the offset for this specific note
  noteOffsets.set(draggedNote, { x: currentX, y: currentY });

  setTranslate(currentX, currentY, draggedNote);
  updateAllConnections();
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  draggedNote = null;
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

// Handle file drag and drop
board.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  board.classList.add("drag-over");
});

board.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  board.classList.remove("drag-over");
});

board.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  board.classList.remove("drag-over");

  // Handle files from drag and drop
  handleFiles(e.dataTransfer.files, e.clientX, e.clientY);
});

// Handle clipboard paste
document.addEventListener("paste", (e) => {
  const items = e.clipboardData.items;
  const files = [];

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const file = items[i].getAsFile();
      files.push(file);
    }
  }

  if (files.length > 0) {
    const targetNote = e.target.closest(".note");
    if (targetNote && targetNote.querySelector("img")) {
      // If pasting into a note that already has an image, update it
      handleImageUpdate(files[0], targetNote);
      e.preventDefault();
    } else if (e.target.classList.contains("note-content")) {
      // If pasting into a note without an image, add it
      handleFiles(files, 0, 0, targetNote);
      e.preventDefault();
    } else {
      // If pasting elsewhere, create new note
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      handleFiles(files, centerX, centerY);
    }
  }
});

// New function to handle updating existing images
function handleImageUpdate(file, note) {
  if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const existingImage = note.querySelector("img");
      if (existingImage) {
        existingImage.style.opacity = "0";
        existingImage.src = event.target.result;

        existingImage.onload = () => {
          existingImage.style.opacity = "1";
          if (existingImage.naturalWidth > 400) {
            const aspectRatio =
              existingImage.naturalHeight / existingImage.naturalWidth;
            existingImage.style.width = "400px";
            existingImage.style.height = `${400 * aspectRatio}px`;
          }
        };
      }
    };
    reader.readAsDataURL(file);
  }
}

// Keep the existing handleFiles function for new images
function handleFiles(files, x, y, targetNote = null) {
  Array.from(files).forEach((file, index) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement("img");
        img.src = event.target.result;
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        img.style.borderRadius = "4px";
        img.style.marginBottom = "8px";
        img.style.opacity = "0";
        img.style.transition = "opacity 0.3s ease";

        img.onload = () => {
          img.style.opacity = "1";
          if (img.naturalWidth > 400) {
            const aspectRatio = img.naturalHeight / img.naturalWidth;
            img.style.width = "400px";
            img.style.height = `${400 * aspectRatio}px`;
          }
        };

        if (targetNote) {
          targetNote.querySelector(".note-content").appendChild(img);
        } else {
          const offsetX = x + index * 20;
          const offsetY = y + index * 20;
          const note = createNote(offsetX - 100, offsetY - 100);
          note.querySelector(".note-content").appendChild(img);
        }
      };
      reader.readAsDataURL(file);
    }
  });
}

// Add context menu functionality
document.addEventListener("contextmenu", (e) => {
  e.preventDefault(); // Prevent default context menu
  hideAllContextMenus();

  // Check if clicked on a connection path
  if (e.target.tagName === "path") {
    const connection = connections.find((conn) => conn.path === e.target);
    if (connection) {
      selectedConnection = connection;
      showConnectionMenu(e.clientX, e.clientY);
    }
  }
  // Check if clicked on a note
  else if (e.target.closest(".note")) {
    selectedNote = e.target.closest(".note");
    showNoteMenu(e.clientX, e.clientY);
  }
});

// Hide context menus when clicking outside
document.addEventListener("click", () => {
  hideAllContextMenus();
});

// Add delete functionality for connections
document
  .querySelector("#connectionMenu .delete")
  .addEventListener("click", () => {
    if (selectedConnection) {
      // Remove the connection element from DOM
      selectedConnection.element.remove();
      // Remove from connections array
      const index = connections.indexOf(selectedConnection);
      if (index > -1) {
        connections.splice(index, 1);
      }
      selectedConnection = null;
      hideConnectionMenu();
    }
  });

// Add delete functionality for notes
document.querySelector("#noteMenu .delete").addEventListener("click", () => {
  if (selectedNote) {
    // Remove all connections associated with this note
    connections = connections.filter((conn) => {
      if (conn.start.note === selectedNote || conn.end.note === selectedNote) {
        conn.element.remove();
        return false;
      }
      return true;
    });

    // Remove the note from DOM
    selectedNote.remove();
    selectedNote = null;
    hideNoteMenu();
  }
});

function showConnectionMenu(x, y) {
  connectionMenu.style.left = `${x}px`;
  connectionMenu.style.top = `${y}px`;
  connectionMenu.classList.add("visible");
}

function hideConnectionMenu() {
  connectionMenu.classList.remove("visible");
  selectedConnection = null;
}

function showNoteMenu(x, y) {
  noteMenu.style.left = `${x}px`;
  noteMenu.style.top = `${y}px`;
  noteMenu.classList.add("visible");
}

function hideNoteMenu() {
  noteMenu.classList.remove("visible");
  selectedNote = null;
}

function hideAllContextMenus() {
  hideConnectionMenu();
  hideNoteMenu();
  colorPalette.classList.remove("visible");
}

function showNotification(message) {
  // Remove existing notification if any
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerHTML = `
    <span class="icon">✅</span>
    <span class="message">${message}</span>
  `;

  // Add to document
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add("show"), 100);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add color change functionality for notes
const colorMenu = document.querySelector(".context-menu-item.colors");
const colorPalette = document.getElementById("colorPalette");
let colorChangeNote = null; // Keep track of note being colored

colorMenu.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent menu from closing immediately

  // Store the note for coloring
  colorChangeNote = selectedNote;

  // Get the current note menu position
  const noteMenu = document.getElementById("noteMenu");
  const rect = noteMenu.getBoundingClientRect();

  // Position the color palette next to the note menu
  colorPalette.style.left = `${rect.right + 5}px`;
  colorPalette.style.top = `${rect.top}px`;

  // Hide note menu and show color palette
  hideNoteMenu();
  colorPalette.classList.add("visible");
});

document.querySelectorAll(".color-option").forEach((option) => {
  option.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent menu from closing
    if (colorChangeNote) {
      colorChangeNote.style.backgroundColor = option.dataset.color;
      colorChangeNote = null; // Clear the reference
      hideAllContextMenus();
    }
  });
});

// Add click outside listener for color palette
document.addEventListener("click", (e) => {
  if (!colorPalette.contains(e.target)) {
    colorPalette.classList.remove("visible");
    colorChangeNote = null; // Clear the reference when clicking outside
  }
});
