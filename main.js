const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const PROC_FILE_PATH = "/proc/avionics_status";
const SYS_PARAM_BASE_PATH = "/sys/module/avionics_sim/parameters";
const SYS_PARAM_WORKLOAD_PATH = `${SYS_PARAM_BASE_PATH}/simulated_workload_ms`;
const SYS_PARAM_PERIOD_PATH = `${SYS_PARAM_BASE_PATH}/task_period_ms`;
const SYS_PARAM_DEADLINE_PATH = `${SYS_PARAM_BASE_PATH}/task_deadline_ms`;

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Uncomment to open DevTools
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handler to read proc file
ipcMain.handle('read-proc-file', async () => {
  try {
    const data = await fs.promises.readFile(PROC_FILE_PATH, 'utf8');
    const lines = data.split('\n');
    const procData = {};
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        procData[key.trim()] = valueParts.join(':').trim();
      }
    });
    return { success: true, data: procData };
  } catch (error) {
    console.error('Failed to read proc file:', error);
    return { success: false, error: error.message, code: error.code };
  }
});

// IPC handler to write sysfs parameter
ipcMain.handle('write-sys-param', async (event, { path, value, paramName }) => {
  console.log(`Attempting to write to ${path}: ${value}`);
  try {
    // Validate value
    if (!/^[1-9]\d*$/.test(value)) {
        throw new Error(`${paramName} must be a positive integer.`);
    }
    await fs.promises.writeFile(path, value);
    return { success: true, message: `${paramName} set to ${value} ms.` };
  } catch (error) {
    console.error(`Failed to write to ${path}:`, error);
    return { success: false, error: error.message, code: error.code };
  }
});

// Expose paths to renderer via IPC
ipcMain.handle('get-param-paths', () => {
    return {
        workload: SYS_PARAM_WORKLOAD_PATH,
        period: SYS_PARAM_PERIOD_PATH,
        deadline: SYS_PARAM_DEADLINE_PATH
    };
}); 