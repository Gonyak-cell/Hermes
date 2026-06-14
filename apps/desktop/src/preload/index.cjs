const { contextBridge, ipcRenderer } = require("electron");

const api = Object.freeze({
  getAppInfo: () => ipcRenderer.invoke("desktop:get-app-info"),
  getShellState: () => ipcRenderer.invoke("desktop:get-shell-state"),
  getReadModel: () => ipcRenderer.invoke("desktop:get-read-model"),
});

contextBridge.exposeInMainWorld("hermesOperator", api);
