const { app, BrowserWindow } = require('electron');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // 这里加载 UI 页面，不直接加载 webview，UI 页面再嵌套 webview
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile('ui/index.html');
});

app.on('window-all-closed', () => {
  app.quit();
});