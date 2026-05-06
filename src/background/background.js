importScripts("../shared/constants.js", "../shared/storage.js", "./provider.js");

const config = self.LinguaPopConfig;
const storage = self.LinguaPopStorage;
const provider = self.LinguaPopProvider;
const translationCache = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "linguapop-translate-selection",
    title: "翻译所选内容",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "linguapop-translate-selection" || !tab || !tab.id) {
    return;
  }

  const text = String(info.selectionText || "").trim();
  if (!text) {
    return;
  }

  try {
    const translation = await getTranslation(text);
    await chrome.tabs.sendMessage(tab.id, {
      type: config.messages.showContextMenuTranslation,
      payload: {
        text,
        translation
      }
    });
  } catch (error) {
    await chrome.tabs.sendMessage(tab.id, {
      type: config.messages.showContextMenuTranslation,
      payload: {
        text,
        error: mapError(error)
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === config.messages.translateSelection) {
    handleTranslateSelection(message.payload)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: mapError(error) }));
    return true;
  }

  if (message.type === config.messages.openOptions) {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === config.messages.updateProvider) {
    storage.writeSettings({
      provider: message.payload && message.payload.provider ? message.payload.provider : config.defaultSettings.provider
    })
      .then((settings) => sendResponse({ ok: true, payload: { provider: settings.provider } }))
      .catch((error) => sendResponse({ ok: false, error: mapError(error) }));
    return true;
  }

  return false;
});

async function handleTranslateSelection(payload) {
  const text = String(payload && payload.text ? payload.text : "").trim();
  const translation = await getTranslation(text, payload && payload.provider ? payload.provider : "");
  return {
    text,
    translation
  };
}

async function getTranslation(text, providerOverride) {
  const settings = await storage.readSettings();
  const selectedProvider = providerOverride || settings.provider;
  const cacheKey = `${selectedProvider}:${text}`;
  const cached = translationCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < config.limits.cacheTtlMs) {
    return cached.translation;
  }

  const translation = await provider.translate({
    text,
    secretId: settings.tencentSecretId,
    secretKey: settings.tencentSecretKey,
    region: settings.tencentRegion,
    projectId: settings.tencentProjectId,
    appId: settings.baiduAppId,
    baiduSecretKey: settings.baiduSecretKey,
    provider: selectedProvider
  });
  translation.provider = selectedProvider;

  translationCache.set(cacheKey, {
    createdAt: Date.now(),
    translation
  });

  return translation;
}

function mapError(error) {
  const code = error && error.code ? error.code : "unknown-error";

  switch (code) {
    case "missing-api-key":
      return {
        code,
        message: "请先在设置页填写当前翻译服务的凭证。"
      };
    case "invalid-api-key":
      return {
        code,
        message: "当前翻译服务的凭证无效，请检查后重试。"
      };
    case "provider-not-activated":
      return {
        code,
        message: "当前翻译服务未开通或未完成授权，请先在控制台启用。"
      };
    case "text-too-long":
      return {
        code,
        message: "选中文本过长，请缩短后再试。"
      };
    case "rate-limited":
      return {
        code,
        message: "请求过于频繁，请稍后再试。"
      };
    case "provider-error":
      return {
        code,
        message: "翻译失败，请稍后重试。"
      };
    case "unsupported-provider":
      return {
        code,
        message: "当前翻译服务暂不支持。"
      };
    default:
      return {
        code,
        message: "网络异常，请稍后重试。"
      };
  }
}
