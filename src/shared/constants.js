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
      maxSelectionLength: 240,
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
