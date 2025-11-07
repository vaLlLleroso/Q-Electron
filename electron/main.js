const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const pyProcs = [];

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL('http://127.0.0.1:5000');
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(() => {
  const isDev = !app.isPackaged;
  const basePath = isDev
    ? path.join(__dirname, '..', 'backend')
    : path.join(process.resourcesPath, 'backend');

  const scripts = ['app.py', 'gpsreq.py'];

  for (const script of scripts) {
    const scriptPath = path.join(basePath, script);
    const proc = spawn('python', [scriptPath]);

    console.log(`started ${scriptPath}`);
    proc.stdout.on('data', data => console.log(`(py) ${script}: ${data}`));
    proc.stderr.on('data', data => console.error(`(th) ${script}: ${data}`));

    pyProcs.push(proc);
  }

  createWindow();
});

app.on('will-quit', () => {
  for (const proc of pyProcs) {
    if (proc) proc.kill();
  }
});
