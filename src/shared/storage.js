(function initLinguaPopStorage(globalScope) {
  const config = globalScope.LinguaPopConfig;
  const areaName = config.storageArea;

  function getArea() {
    return chrome.storage[areaName] || chrome.storage.local;
  }

  function readSettings() {
    const defaults = config.defaultSettings;
    return getArea().get(defaults).then((stored) => ({
      tencentSecretId: String(stored.tencentSecretId || "").trim(),
      tencentSecretKey: String(stored.tencentSecretKey || "").trim(),
      tencentRegion: String(stored.tencentRegion || defaults.tencentRegion).trim() || defaults.tencentRegion,
      tencentProjectId: String(stored.tencentProjectId || defaults.tencentProjectId).trim() || defaults.tencentProjectId,
      baiduAppId: String(stored.baiduAppId || "").trim(),
      baiduSecretKey: String(stored.baiduSecretKey || "").trim(),
      nativeLanguage: stored.nativeLanguage || defaults.nativeLanguage,
      triggerMode: stored.triggerMode || defaults.triggerMode,
      provider: stored.provider || defaults.provider
    }));
  }

  function writeSettings(partialSettings) {
    return readSettings().then((current) => {
      const nextSettings = {
        ...current,
        ...partialSettings
      };
      return getArea().set(nextSettings).then(() => nextSettings);
    });
  }

  globalScope.LinguaPopStorage = {
    readSettings,
    writeSettings
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
