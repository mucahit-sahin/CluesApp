const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
const dataPath = path.join(app.getPath("userData"), "boards.json");

// Helper function to read boards data
function readBoardsData() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, "utf8");
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error("Error reading boards data:", error);
    return [];
  }
}

// Helper function to write boards data
function writeBoardsData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing boards data:", error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f5f5f5",
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Handle board actions
ipcMain.on("new-board", () => {
  mainWindow.loadFile("board.html");
});

ipcMain.on("open-board", (event, boardId) => {
  mainWindow.loadFile("board.html", {
    query: { id: boardId },
  });
});

ipcMain.on("save-board", (event, boardData) => {
  // Get existing boards
  const savedBoards = readBoardsData();

  // Update or add new board
  const existingBoardIndex = savedBoards.findIndex(
    (board) => board.id === boardData.id
  );
  if (existingBoardIndex !== -1) {
    savedBoards[existingBoardIndex] = {
      ...savedBoards[existingBoardIndex],
      ...boardData,
      lastEdited: Date.now(),
    };
  } else {
    savedBoards.push({
      ...boardData,
      lastEdited: Date.now(),
    });
  }

  // Save back to file
  writeBoardsData(savedBoards);

  event.reply("board-saved", boardData.id);
});

// Add getter for saved boards
ipcMain.handle("get-saved-boards", () => {
  return readBoardsData();
});

// Add delete board handler
ipcMain.handle("delete-board", (event, boardId) => {
  const savedBoards = readBoardsData();
  const updatedBoards = savedBoards.filter((board) => board.id !== boardId);
  writeBoardsData(updatedBoards);
  return updatedBoards;
});

ipcMain.on("return-to-home", () => {
  mainWindow.loadFile("index.html");
});
