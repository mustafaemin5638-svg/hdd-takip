const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hddTakip', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  installGuard: () => ipcRenderer.invoke('app:installGuard'),
  quit: () => ipcRenderer.invoke('app:quit'),
  createOwnerDesktopShortcut: () => ipcRenderer.invoke('app:createOwnerDesktopShortcut'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },

  auth: {
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getRemembered: () => ipcRenderer.invoke('auth:getRemembered'),
    getMachineBinding: () => ipcRenderer.invoke('auth:getMachineBinding'),
    hasMasterPassword: () => ipcRenderer.invoke('auth:hasMasterPassword'),
    setMasterPassword: (password) => ipcRenderer.invoke('auth:setMasterPassword', password),
    listCredentials: (masterPassword) =>
      ipcRenderer.invoke('auth:listCredentials', masterPassword),
    grantLicense: (payload) => ipcRenderer.invoke('auth:grantLicense', payload),
    setLicenseStatus: (payload) => ipcRenderer.invoke('auth:setLicenseStatus', payload),
    setRemoteLicenseUrl: (payload) => ipcRenderer.invoke('auth:setRemoteLicenseUrl', payload),
    getRemoteLicenseUrl: (masterPassword) =>
      ipcRenderer.invoke('auth:getRemoteLicenseUrl', masterPassword),
    updateIndividual: (payload) => ipcRenderer.invoke('auth:updateIndividual', payload),
    updateCompany: (payload) => ipcRenderer.invoke('auth:updateCompany', payload),
    updateStaffMember: (payload) => ipcRenderer.invoke('auth:updateStaffMember', payload),
    deleteIndividual: (payload) => ipcRenderer.invoke('auth:deleteIndividual', payload),
    deleteCompany: (payload) => ipcRenderer.invoke('auth:deleteCompany', payload),
    deleteStaffMember: (payload) => ipcRenderer.invoke('auth:deleteStaffMember', payload),
    setAccountStatus: (payload) => ipcRenderer.invoke('auth:setAccountStatus', payload),
    registerIndividual: (payload) => ipcRenderer.invoke('auth:registerIndividual', payload),
    loginIndividual: (payload) => ipcRenderer.invoke('auth:loginIndividual', payload),
    registerCompanyAdmin: (payload) =>
      ipcRenderer.invoke('auth:registerCompanyAdmin', payload),
    loginCompanyAdmin: (payload) => ipcRenderer.invoke('auth:loginCompanyAdmin', payload),
    loginCompanyStaff: (payload) => ipcRenderer.invoke('auth:loginCompanyStaff', payload),
    addStaff: (payload) => ipcRenderer.invoke('auth:addStaff', payload),
    listStaff: () => ipcRenderer.invoke('auth:listStaff'),
    changeOwnPassword: (payload) => ipcRenderer.invoke('auth:changeOwnPassword', payload),
  },
})
