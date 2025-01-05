const board = document.getElementById("board");
const addNoteBtn = document.getElementById("addNote");
const connectModeBtn = document.getElementById("connectMode");
const searchBtn = document.getElementById("search");

let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let selectedNote = null;

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

  const textarea = document.createElement("textarea");
  textarea.className = "note-content";
  textarea.placeholder = "Write your note here...";
  note.appendChild(textarea);

  // Add connection points
  const connectionPoints = [
    {
      position: "right",
      x: "100%",
      y: "50%",
      transform: "translate(50%, -50%)",
    },
    { position: "left", x: "0%", y: "50%", transform: "translate(-50%, -50%)" },
    { position: "top", x: "50%", y: "0%", transform: "translate(-50%, -50%)" },
    {
      position: "bottom",
      x: "50%",
      y: "100%",
      transform: "translate(-50%, 50%)",
    },
  ];

  connectionPoints.forEach((point) => {
    const connectionPoint = document.createElement("div");
    connectionPoint.className = "connection-point";
    connectionPoint.dataset.position = point.position;
    connectionPoint.style.left = point.x;
    connectionPoint.style.top = point.y;
    connectionPoint.style.transform = point.transform;

    connectionPoint.addEventListener("click", handleConnectionPointClick);
    note.appendChild(connectionPoint);
  });

  board.appendChild(note);

  // Add drag functionality
  note.addEventListener("mousedown", dragStart);
  note.addEventListener("mousemove", drag);
  note.addEventListener("mouseup", dragEnd);
  note.addEventListener("mouseleave", dragEnd);

  return note;
}

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
  board.appendChild(connection);

  connections.push({
    element: connection,
    start: start,
    end: end,
  });

  updateConnection(connections[connections.length - 1]);
}

function updateConnection(connection) {
  const startRect = connection.start.element.getBoundingClientRect();
  const endRect = connection.end.element.getBoundingClientRect();

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const endX = endRect.left + endRect.width / 2;
  const endY = endRect.top + endRect.height / 2;

  const length = Math.sqrt(
    Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
  );
  const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

  connection.element.style.width = `${length}px`;
  connection.element.style.left = `${startX}px`;
  connection.element.style.top = `${startY}px`;
  connection.element.style.transform = `rotate(${angle}deg)`;
}

function updateAllConnections() {
  connections.forEach(updateConnection);
}

function dragStart(e) {
  if (
    e.target.className === "note-content" ||
    e.target.className === "connection-point"
  )
    return;

  selectedNote = e.target.closest(".note");
  if (!selectedNote) return;

  const offset = noteOffsets.get(selectedNote);
  initialX = e.clientX - offset.x;
  initialY = e.clientY - offset.y;

  isDragging = true;
}

function drag(e) {
  if (!isDragging || !selectedNote) return;

  e.preventDefault();
  currentX = e.clientX - initialX;
  currentY = e.clientY - initialY;

  // Update the offset for this specific note
  noteOffsets.set(selectedNote, { x: currentX, y: currentY });

  setTranslate(currentX, currentY, selectedNote);
  updateAllConnections();
}

function dragEnd(e) {
  isDragging = false;
  selectedNote = null;
}

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
