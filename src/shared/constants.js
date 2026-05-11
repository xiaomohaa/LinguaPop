(function initLinguaPopConstants(globalScope) {
  const CONFIG = {
    storageArea: "sync",
    storageKeys: {
      tencentSecretId: "tencentSecretId",
      tencentSecretKey: "tencentSecretKey",
      tencentRegion: "tencentRegion",
      tencentProjectId: "tencentProjectId",
      baiduAppId: "baiduAppId",
      baiduSecretKey: "baiduSecretKey",
      nativeLanguage: "nativeLanguage",
      maxSelectionLength: "maxSelectionLength",
      triggerMode: "triggerMode",
      provider: "provider"
    },
    triggerModes: {
      auto: "auto",
      button: "button"
    },
    defaultSettings: {
      tencentSecretId: "",
      tencentSecretKey: "",
      tencentRegion: "ap-guangzhou",
      tencentProjectId: "0",
      baiduAppId: "",
      baiduSecretKey: "",
      nativeLanguage: "zh",
      maxSelectionLength: 5000,
      triggerMode: "auto",
      provider: "tencent"
    },
    provider: {
      tencent: "tencent",
      baidu: "baidu",
      google: "google"
    },
    nativeLanguage: {
      zh: "zh",
      en: "en"
    },
    limits: {
      minSelectionLength: 1,
      maxSelectionLength: 20000,
      providerChunkLength: 900,
      cacheTtlMs: 60 * 1000
    },
    messages: {
      translateSelection: "linguapop:translate-selection",
      showContextMenuTranslation: "linguapop:show-context-menu-translation",
      openOptions: "linguapop:open-options",
      updateProvider: "linguapop:update-provider"
    }
  };

  globalScope.LinguaPopConfig = CONFIG;
})(typeof globalThis !== "undefined" ? globalThis : window);
