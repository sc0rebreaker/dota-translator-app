const { contextBridge, ipcRenderer } = require('electron');

// The setup window's whole reach into the app: ask what is set, save the
// settings, the key, close.
contextBridge.exposeInMainWorld('setup', {
  state: () => ipcRenderer.invoke('setup:state'),
  save: (payload) => ipcRenderer.invoke('setup:save', payload),
  close: () => ipcRenderer.invoke('setup:close'),
  fit: () => ipcRenderer.invoke('setup:fit'),
  folder: () => ipcRenderer.invoke('setup:folder'),
  sayInto: (which) => ipcRenderer.invoke('setup:sayInto', which),
  theirs: (which) => ipcRenderer.invoke('setup:theirs', which),
  // Whether this copy is up to date, and a way to look now / install now.
  update: () => ipcRenderer.invoke('setup:update'),
  quitInstall: () => ipcRenderer.invoke('setup:quitInstall'),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, s) => cb(s)),
  // The key (0.8.0): handed IN to be tried and saved; it never comes back out.
  saveKey: (key) => ipcRenderer.invoke('setup:key', key),
  guide: () => ipcRenderer.invoke('setup:guide'),
});
