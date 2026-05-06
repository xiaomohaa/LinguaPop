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
  const tencentFields = document.getElementById("tencent-fields");
  const baiduFields = document.getElementById("baidu-fields");
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
    tencentFields.hidden = !isTencent;
    baiduFields.hidden = isTencent;
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
      triggerMode: String(formData.get("triggerMode") || config.triggerModes.auto),
    };

    await storage.writeSettings(nextSettings);
    statusNode.textContent = "设置已保存。";
    window.setTimeout(() => {
      statusNode.textContent = "";
    }, 2500);
  }
})(window);
