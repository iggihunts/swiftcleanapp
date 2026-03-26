const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('swiftclean', {
  // Core invoke - calls main process handlers
  invoke: (channel, args) => ipcRenderer.invoke(channel, args),

  // Event listeners - for streaming progress back to UI
  on: (channel, callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on(channel, sub);
    // Return unlisten function
    return () => ipcRenderer.removeListener(channel, sub);
  },

  // One-time listener
  once: (channel, callback) => {
    ipcRenderer.once(channel, (event, data) => callback(data));
  },
});
