'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('TrustChatDesktop', {
  getState: function () {
    return ipcRenderer.invoke('trustchat:get-state');
  },
  saveSite: function (payload) {
    return ipcRenderer.invoke('trustchat:save-site', payload || {});
  },
  clearSite: function () {
    return ipcRenderer.invoke('trustchat:clear-site');
  }
});
