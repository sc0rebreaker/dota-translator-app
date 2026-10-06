const { contextBridge, ipcRenderer } = require('electron');

// The setup window's whole reach into the app: ask what is set, save the
// settings, the account, close.
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
  // The account (0.7.0). The session token never crosses this bridge.
  account: () => ipcRenderer.invoke('account:state'),
  signStart: (email) => ipcRenderer.invoke('account:start', email),
  signVerify: (email, code) => ipcRenderer.invoke('account:verify', email, code),
  signCancel: () => ipcRenderer.invoke('account:cancel'),
  resetHwid: () => ipcRenderer.invoke('account:reset'),
  buy: () => ipcRenderer.invoke('account:buy'),
  logout: () => ipcRenderer.invoke('account:logout'),
  onAccount: (cb) => ipcRenderer.on('account', (_e, s) => cb(s)),
});
