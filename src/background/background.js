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

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
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
  const translation = await getTranslation(
    text,
    payload && payload.provider ? payload.provider : "",
    Boolean(payload && payload.forceTranslate)
  );
  return {
    text,
    translation
  };
}

async function getTranslation(text, providerOverride, forceTranslate) {
  const settings = await storage.readSettings();
  const selectedProvider = providerOverride || settings.provider;
  const detectedLanguage = detectLanguage(text);
  const maxSelectionLength = normalizeMaxSelectionLength(settings.maxSelectionLength);

  if (!forceTranslate && detectedLanguage && detectedLanguage === settings.nativeLanguage) {
    const error = new Error("same-as-native-language");
    error.code = "same-as-native-language";
    throw error;
  }

  if (text.length > maxSelectionLength) {
    const error = new Error("text-too-long");
    error.code = "text-too-long";
    error.maxSelectionLength = maxSelectionLength;
    throw error;
  }

  const cacheKey = `${selectedProvider}:${text}`;
  const cached = translationCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < config.limits.cacheTtlMs) {
    return cached.translation;
  }

  const providerInput = {
    text,
    secretId: settings.tencentSecretId,
    secretKey: settings.tencentSecretKey,
    region: settings.tencentRegion,
    projectId: settings.tencentProjectId,
    appId: settings.baiduAppId,
    baiduSecretKey: settings.baiduSecretKey,
    provider: selectedProvider
  };
  const translation = await translateText(providerInput, detectedLanguage);
  translation.provider = selectedProvider;

  translationCache.set(cacheKey, {
    createdAt: Date.now(),
    translation
  });

  return translation;
}

async function translateText(input, detectedLanguage) {
  const chunks = splitTextIntoChunks(input.text, config.limits.providerChunkLength);
  const targetLang = getTargetLanguage(detectedLanguage, input.text);

  if (chunks.length <= 1) {
    return provider.translate({
      ...input,
      targetLang
    });
  }

  const translations = [];
  for (const chunk of chunks) {
    const translation = await provider.translate({
      ...input,
      text: chunk,
      targetLang
    });
    translations.push(translation);
  }

  return {
    originalText: input.text,
    translatedText: translations.map((translation) => translation.translatedText).join("\n"),
    sourceLang: translations[0] ? translations[0].sourceLang : "",
    targetLang: translations[0] ? translations[0].targetLang : ""
  };
}

function splitTextIntoChunks(text, maxChunkLength) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return [];
  }

  const sentences = normalized.match(/[^。！？.!?]+[。！？.!?]?|\S+/g) || [normalized];
  const chunks = [];
  let current = "";

  sentences.forEach((sentence) => {
    const part = sentence.trim();
    if (!part) {
      return;
    }

    if (part.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let index = 0; index < part.length; index += maxChunkLength) {
        chunks.push(part.slice(index, index + maxChunkLength));
      }
      return;
    }

    const next = current ? `${current} ${part}` : part;
    if (next.length > maxChunkLength) {
      chunks.push(current);
      current = part;
      return;
    }

    current = next;
  });

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function getTargetLanguage(detectedLanguage, text) {
  const sourceLanguage = detectedLanguage || detectLanguage(text);
  if (sourceLanguage === config.nativeLanguage.zh) {
    return "en";
  }
  if (sourceLanguage === config.nativeLanguage.en) {
    return "zh";
  }
  return "";
}

function normalizeMaxSelectionLength(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return config.defaultSettings.maxSelectionLength;
  }
  return Math.max(
    config.limits.minSelectionLength,
    Math.min(parsed, config.limits.maxSelectionLength)
  );
}

function detectLanguage(text) {
  const sample = String(text || "").trim();
  if (!sample) {
    return "";
  }

  const cjkMatches = sample.match(/[\u3400-\u9fff]/g);
  const latinMatches = sample.match(/[A-Za-z]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;

  if (cjkCount === 0 && latinCount === 0) {
    return "";
  }

  if (cjkCount > latinCount) {
    return config.nativeLanguage.zh;
  }

  if (latinCount > cjkCount) {
    return config.nativeLanguage.en;
  }

  return "";
}

function mapError(error) {
  const code = error && error.code ? error.code : "unknown-error";

  switch (code) {
    case "same-as-native-language":
      return {
        code,
        message: "已是母语内容，未发起翻译请求。"
      };
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
        message: `选中文本过长，请控制在 ${error.maxSelectionLength || config.defaultSettings.maxSelectionLength} 字符以内。`
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
    case "unknown-error":
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
