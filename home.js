const { ipcRenderer, shell } = require("electron");
const newBoardBtn = document.getElementById("newBoard");
const savedBoardsBtn = document.getElementById("savedBoards");
const boardsContainer = document.getElementById("boardsContainer");
const boardsGrid = document.getElementById("boardsGrid");
const backButton = document.getElementById("backButton");
const optionsContainer = document.querySelector(".options");
const themeToggle = document.getElementById("themeToggle");

// Theme handling
let currentTheme = "light";

async function initializeTheme() {
  currentTheme = await ipcRenderer.invoke("get-theme");
  document.documentElement.dataset.theme = currentTheme;
  updateThemeIcon();
}

function updateThemeIcon() {
  themeToggle.textContent = currentTheme === "light" ? "🌞" : "🌙";
}

themeToggle.addEventListener("click", async () => {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = currentTheme;
  await ipcRenderer.invoke("set-theme", currentTheme);
  updateThemeIcon();
});

// Initialize theme on load
initializeTheme();

// Load saved boards using IPC
async function loadSavedBoards() {
  const savedBoards = await ipcRenderer.invoke("get-saved-boards");
  boardsGrid.innerHTML = "";

  if (savedBoards.length === 0) {
    boardsGrid.innerHTML =
      '<div style="text-align: center; color: #666;">No saved boards yet</div>';
    return;
  }

  savedBoards.forEach((board) => {
    const boardCard = document.createElement("div");
    boardCard.className = "board-card";
    boardCard.style.position = "relative";
    boardCard.innerHTML = `
      <div class="title">${board.name}</div>
      <div class="date">Last edited: ${new Date(
        board.lastEdited
      ).toLocaleString()}</div>
      <button class="delete-btn" title="Delete Board">×</button>
    `;

    // Add click event for opening the board
    boardCard.addEventListener("click", (e) => {
      // Don't open board if delete button was clicked
      if (!e.target.classList.contains("delete-btn")) {
        ipcRenderer.send("open-board", board.id);
      }
    });

    // Add delete functionality
    const deleteBtn = boardCard.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Prevent board from opening
      if (confirm("Are you sure you want to delete this board?")) {
        const updatedBoards = await ipcRenderer.invoke(
          "delete-board",
          board.id
        );
        loadSavedBoards(); // Reload the board list
      }
    });

    boardsGrid.appendChild(boardCard);
  });
}

// Event Listeners
newBoardBtn.addEventListener("click", () => {
  ipcRenderer.send("new-board");
});

savedBoardsBtn.addEventListener("click", () => {
  optionsContainer.style.display = "none";
  boardsContainer.classList.add("visible");
  loadSavedBoards();
});

backButton.addEventListener("click", () => {
  boardsContainer.classList.remove("visible");
  optionsContainer.style.display = "flex";
});

// Handle GitHub link click
document.querySelector(".github-info a").addEventListener("click", (e) => {
  e.preventDefault();
  shell.openExternal(e.currentTarget.href);
});
