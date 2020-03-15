const {
  app,
  BrowserWindow
} = require('electron');

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 1000,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // mainWindow.webContents.openDevTools();
  mainWindow.loadFile('./views/index.html');
});
