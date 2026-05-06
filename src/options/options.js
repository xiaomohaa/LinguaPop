(function initOptionsPage(globalScope) {
  const config = globalScope.LinguaPopConfig;
  const storage = globalScope.LinguaPopStorage;

  const form = document.getElementById("settings-form");
  const providerInput = document.getElementById("provider");
  const tencentSecretIdInput = document.getElementById("tencent-secret-id");
  const tencentSecretKeyInput = document.getElementById("tencent-secret-key");
  const tencentRegionInput = document.getElementById("tencent-region");
  const tencentProjectIdInput = document.getElementById("tencent-project-id");
  const baiduAppIdInput = document.getElementById("baidu-app-id");
  const baiduSecretKeyInput = document.getElementById("baidu-secret-key");
  const nativeLanguageInput = document.getElementById("native-language");
  const tencentFields = document.getElementById("tencent-fields");
  const baiduFields = document.getElementById("baidu-fields");
  const providerNote = document.getElementById("provider-note");
  const statusNode = document.getElementById("status");

  form.addEventListener("submit", onSubmit);
  providerInput.addEventListener("change", onProviderChange);
  load();

  async function load() {
    const settings = await storage.readSettings();
    providerInput.value = settings.provider || config.defaultSettings.provider;
    tencentSecretIdInput.value = settings.tencentSecretId;
    tencentSecretKeyInput.value = settings.tencentSecretKey;
    tencentRegionInput.value = settings.tencentRegion || config.defaultSettings.tencentRegion;
    tencentProjectIdInput.value = settings.tencentProjectId || config.defaultSettings.tencentProjectId;
    baiduAppIdInput.value = settings.baiduAppId;
    baiduSecretKeyInput.value = settings.baiduSecretKey;
    nativeLanguageInput.value = settings.nativeLanguage || config.defaultSettings.nativeLanguage;
    syncProviderFields(providerInput.value);

    const triggerInput = form.elements.namedItem("triggerMode");
    if (triggerInput instanceof RadioNodeList) {
      triggerInput.value = settings.triggerMode || config.triggerModes.auto;
    }
  }

  function onProviderChange(event) {
    syncProviderFields(event.target.value);
  }

  function syncProviderFields(provider) {
    const isTencent = provider === config.provider.tencent;
    const isBaidu = provider === config.provider.baidu;

    tencentFields.hidden = !isTencent;
    baiduFields.hidden = !isBaidu;
    providerNote.textContent = getProviderNote(provider);
  }

  function getProviderNote(provider) {
    if (provider === config.provider.tencent) {
      return "腾讯云模式需要填写 SecretId 和 SecretKey。";
    }

    if (provider === config.provider.baidu) {
      return "百度模式需要填写 App ID 和 Secret Key。";
    }

    if (provider === config.provider.google) {
      return "Google 为免配置的实验性模式，不保证长期稳定，可能出现限流或失效。";
    }

    return "";
  }

  async function onSubmit(event) {
    event.preventDefault();
    const formData = new FormData(form);
    const nextSettings = {
      provider: String(formData.get("provider") || config.defaultSettings.provider),
      tencentSecretId: String(formData.get("tencentSecretId") || "").trim(),
      tencentSecretKey: String(formData.get("tencentSecretKey") || "").trim(),
      tencentRegion: String(formData.get("tencentRegion") || config.defaultSettings.tencentRegion).trim() || config.defaultSettings.tencentRegion,
      tencentProjectId: String(formData.get("tencentProjectId") || config.defaultSettings.tencentProjectId).trim() || config.defaultSettings.tencentProjectId,
      baiduAppId: String(formData.get("baiduAppId") || "").trim(),
      baiduSecretKey: String(formData.get("baiduSecretKey") || "").trim(),
      nativeLanguage: String(formData.get("nativeLanguage") || config.defaultSettings.nativeLanguage),
      triggerMode: String(formData.get("triggerMode") || config.triggerModes.auto),
    };

    await storage.writeSettings(nextSettings);
    statusNode.textContent = "设置已保存。";
    window.setTimeout(() => {
      statusNode.textContent = "";
    }, 2500);
  }
})(window);
