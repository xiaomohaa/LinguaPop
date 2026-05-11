(function initLinguaPopContent(globalScope) {
  const config = globalScope.LinguaPopConfig;
  const storage = globalScope.LinguaPopStorage;
  const logoUrl = chrome.runtime.getURL("src/assets/logo.png");

  const state = {
    settings: { ...config.defaultSettings },
    selectedText: "",
    selectedRect: null,
    anchorPoint: null,
    activeRequestId: 0,
    buttonElement: null,
    popupElement: null,
    popupContext: null,
    dragState: null
  };

  boot();

  function boot() {
    document.addEventListener("mouseup", onSelectionInteraction, true);
    document.addEventListener("keyup", onSelectionInteraction, true);
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("mousemove", onDocumentMouseMove, true);
    document.addEventListener("mouseup", onDocumentMouseUp, true);

    chrome.runtime.onMessage.addListener((message) => {
      if (!message || !message.type) {
        return;
      }

      if (message.type === config.messages.showContextMenuTranslation) {
        showContextMenuResult(message.payload);
      }
    });

    loadSettings();
    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  async function loadSettings() {
    try {
      state.settings = await storage.readSettings();
    } catch (error) {
      if (!isExtensionContextInvalidated(error)) {
        throw error;
      }
    }
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== config.storageArea && areaName !== "local") {
      return;
    }

    const updated = { ...state.settings };
    let shouldUpdate = false;

    Object.keys(config.storageKeys).forEach((keyName) => {
      const storageKey = config.storageKeys[keyName];
      if (changes[storageKey]) {
        updated[storageKey] = changes[storageKey].newValue;
        shouldUpdate = true;
      }
    });

    if (shouldUpdate) {
      state.settings = {
        ...state.settings,
        ...updated
      };
    }
  }

  function onSelectionInteraction(event) {
    if (isEventInsideOverlay(event)) {
      return;
    }

    if (event.type === "mouseup") {
      state.anchorPoint = { x: event.clientX, y: event.clientY };
    }

    window.setTimeout(handleSelectionChange, 0);
  }

  function handleSelectionChange() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      closeButton();
      return;
    }

    if (isSelectionInsideOverlay(selection)) {
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const selectionResult = sanitizeSelectionText(selection.toString());

    if (!isValidRect(rect)) {
      closeButton();
      return;
    }

    if (selectionResult.reason === "too-long") {
      closeButton();
      renderPopup({
        rect,
        status: "error",
        originalText: selectionResult.previewText,
        error: {
          code: "text-too-long",
          message: `选中文本过长，请控制在 ${getMaxSelectionLength()} 字符以内。`
        }
      });
      return;
    }

    if (!selectionResult.text) {
      closeButton();
      return;
    }

    const text = selectionResult.text;

    state.selectedText = text;
    state.selectedRect = rect;

    if (state.settings.triggerMode === config.triggerModes.button) {
      renderButton(rect, text);
      closePopup();
      return;
    }

    closeButton();
    requestTranslation(text, rect);
  }

  function sanitizeSelectionText(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return {
        text: "",
        reason: "empty",
        previewText: ""
      };
    }

    const maxSelectionLength = getMaxSelectionLength();
    if (normalized.length > maxSelectionLength) {
      return {
        text: "",
        reason: "too-long",
        previewText: normalized.slice(0, maxSelectionLength)
      };
    }

    return {
      text: normalized,
      reason: "",
      previewText: normalized
    };
  }

  function isValidRect(rect) {
    return rect && rect.width > 0 && rect.height > 0;
  }

  function getMaxSelectionLength() {
    const parsed = Number.parseInt(state.settings.maxSelectionLength, 10);
    if (!Number.isFinite(parsed)) {
      return config.defaultSettings.maxSelectionLength;
    }
    return Math.max(
      config.limits.minSelectionLength,
      Math.min(parsed, config.limits.maxSelectionLength)
    );
  }

  function renderButton(rect, text) {
    closeButton();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "linguapop-trigger-button";
    button.textContent = "译";
    positionElement(button, rect, { offsetY: 10 });
    button.addEventListener("mousedown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      requestTranslation(text, rect);
      closeButton();
    });
    document.body.appendChild(button);
    state.buttonElement = button;
  }

  function requestTranslation(text, rect, options) {
    const requestOptions = options || {};
    state.activeRequestId += 1;
    const requestId = state.activeRequestId;
    state.popupContext = {
      text,
      rect,
      provider: requestOptions.providerOverride || state.settings.provider
    };

    renderPopup({
      rect,
      status: "loading",
      originalText: text,
      provider: state.popupContext.provider
    });

    try {
      chrome.runtime.sendMessage(
        {
          type: config.messages.translateSelection,
          payload: {
            text,
            provider: requestOptions.providerOverride || undefined,
            forceTranslate: Boolean(requestOptions.forceTranslate)
          }
        },
        (response) => {
          if (requestId !== state.activeRequestId) {
            return;
          }

          if (chrome.runtime.lastError) {
            renderRuntimeError(rect, text, chrome.runtime.lastError.message);
            return;
          }

          if (!response || !response.ok) {
            renderPopup({
              rect,
              status: "error",
              originalText: text,
              error: response ? response.error : { code: "unknown-error", message: "翻译失败，请稍后重试。" }
            });
            return;
          }

          renderPopup({
            rect,
            status: "success",
            originalText: text,
            translation: response.payload.translation,
            provider: response.payload.translation.provider
          });
        }
      );
    } catch (error) {
      renderRuntimeError(rect, text, error && error.message ? error.message : "");
    }
  }

  function showContextMenuResult(payload) {
    const rect = state.selectedRect || fallbackRectFromPoint();
    const status = payload.error ? "error" : "success";

    renderPopup({
      rect,
      status,
      originalText: payload.text,
      translation: payload.translation,
      error: payload.error,
      provider: payload.translation ? payload.translation.provider : state.settings.provider
    });
  }

  function fallbackRectFromPoint() {
    const point = state.anchorPoint || {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2)
    };

    return {
      left: point.x,
      right: point.x,
      top: point.y,
      bottom: point.y,
      width: 0,
      height: 0
    };
  }

  function renderPopup(viewModel) {
    closePopup();

    const popup = document.createElement("section");
    popup.className = "linguapop-popup";
    popup.dataset.linguapopOverlay = "popup";
    popup.addEventListener("mousedown", stopOverlayEvent);
    popup.addEventListener("mouseup", stopOverlayEvent);

    const header = document.createElement("header");
    header.className = "linguapop-header";
    header.addEventListener("mousedown", onHeaderDragStart);

    const brand = document.createElement("div");
    brand.className = "linguapop-brand";

    const titleRow = document.createElement("div");
    titleRow.className = "linguapop-title-row";

    const logoBadge = document.createElement("img");
    logoBadge.className = "linguapop-logo";
    logoBadge.src = logoUrl;
    logoBadge.alt = "LinguaPop";
    titleRow.appendChild(logoBadge);

    const meta = document.createElement("p");
    meta.className = "linguapop-meta";
    meta.textContent = viewModel.translation ? formatLanguageMeta(viewModel.translation) : "翻译中";
    titleRow.appendChild(meta);

    const providerSwitch = document.createElement("select");
    providerSwitch.className = "linguapop-provider";
    buildProviderOptions(providerSwitch, viewModel.provider || (viewModel.translation && viewModel.translation.provider) || state.settings.provider);
    providerSwitch.addEventListener("change", (event) => {
      switchProviderFromPopup(event.target.value);
    });
    titleRow.appendChild(providerSwitch);

    brand.appendChild(titleRow);

    header.appendChild(brand);

    const headerActions = document.createElement("div");
    headerActions.className = "linguapop-header-actions";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "linguapop-close";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => clearTransientUi());
    headerActions.appendChild(closeButton);

    header.appendChild(headerActions);

    popup.appendChild(header);

    const body = document.createElement("div");
    body.className = "linguapop-body";

    const sourceSection = document.createElement("section");
    sourceSection.className = "linguapop-section";

    const sourceLabel = document.createElement("p");
    sourceLabel.className = "linguapop-label";
    sourceLabel.textContent = "原文";
    sourceSection.appendChild(sourceLabel);

    const source = document.createElement("p");
    source.className = "linguapop-original";
    source.textContent = viewModel.originalText;
    sourceSection.appendChild(source);

    body.appendChild(sourceSection);

    if (viewModel.status === "loading") {
      const divider = document.createElement("div");
      divider.className = "linguapop-divider";
      body.appendChild(divider);

      const loading = document.createElement("p");
      loading.className = "linguapop-status";
      loading.textContent = "正在翻译...";
      body.appendChild(loading);
    }

    if (viewModel.status === "success" && viewModel.translation) {
      const divider = document.createElement("div");
      divider.className = "linguapop-divider";
      body.appendChild(divider);

      const translatedSection = document.createElement("section");
      translatedSection.className = "linguapop-section";

      const translatedLabel = document.createElement("p");
      translatedLabel.className = "linguapop-label";
      translatedLabel.textContent = "译文";
      translatedSection.appendChild(translatedLabel);

      const translated = document.createElement("p");
      translated.className = "linguapop-translated";
      translated.textContent = viewModel.translation.translatedText;
      translatedSection.appendChild(translated);

      body.appendChild(translatedSection);
    }

    if (viewModel.status === "error" && viewModel.error) {
      const divider = document.createElement("div");
      divider.className = "linguapop-divider";
      body.appendChild(divider);

      const error = document.createElement("p");
      error.className = "linguapop-error";
      error.textContent = viewModel.error.message;
      body.appendChild(error);

      if (viewModel.error.code === "missing-api-key" || viewModel.error.code === "invalid-api-key") {
        const settingsButton = document.createElement("button");
        settingsButton.type = "button";
        settingsButton.className = "linguapop-settings";
        settingsButton.textContent = "打开设置";
        settingsButton.addEventListener("click", () => {
          try {
            chrome.runtime.sendMessage({ type: config.messages.openOptions });
          } catch (error) {
            if (isExtensionContextInvalidated(error)) {
              renderPopup({
                rect: viewModel.rect,
                status: "error",
                originalText: viewModel.originalText,
                error: {
                  code: "extension-context-invalidated",
                  message: "扩展已更新，请刷新当前页面后重试。"
                }
              });
            }
          }
        });
        body.appendChild(settingsButton);
      }

      if (viewModel.error.code === "same-as-native-language") {
        const continueButton = document.createElement("button");
        continueButton.type = "button";
        continueButton.className = "linguapop-settings";
        continueButton.textContent = "继续翻译";
        continueButton.addEventListener("click", () => {
          requestTranslation(viewModel.originalText, viewModel.rect, {
            providerOverride: viewModel.provider || state.settings.provider,
            forceTranslate: true
          });
        });
        body.appendChild(continueButton);
      }
    }

    popup.appendChild(body);
    document.body.appendChild(popup);
    positionElement(popup, viewModel.rect, { offsetY: 12, preferLeftAligned: true });
    state.popupElement = popup;
    state.popupContext = {
      text: viewModel.originalText,
      rect: viewModel.rect,
      provider: viewModel.provider || (viewModel.translation && viewModel.translation.provider) || state.settings.provider
    };
  }

  function formatLanguageMeta(translation) {
    const source = translation.sourceLang === "ZH" ? "中文" : "English";
    const target = translation.targetLang === "ZH" ? "中文" : "English";
    return `${source} → ${target}`;
  }

  function formatProviderName(provider) {
    if (provider === config.provider.tencent) {
      return "腾讯";
    }

    if (provider === config.provider.baidu) {
      return "百度";
    }

    if (provider === config.provider.google) {
      return "谷歌";
    }

    return provider;
  }

  function buildProviderOptions(selectElement, selectedProvider) {
    const providers = [
      config.provider.tencent,
      config.provider.baidu,
      config.provider.google
    ];

    providers.forEach((provider) => {
      const option = document.createElement("option");
      option.value = provider;
      option.textContent = formatProviderName(provider);
      option.selected = provider === selectedProvider;
      selectElement.appendChild(option);
    });
  }

  function switchProviderFromPopup(nextProvider) {
    if (!state.popupContext || !state.popupContext.text || !state.popupContext.rect) {
      return;
    }
    const currentContext = {
      text: state.popupContext.text,
      rect: state.popupContext.rect
    };

    if (nextProvider === (state.popupContext.provider || state.settings.provider)) {
      return;
    }

    renderPopup({
      rect: currentContext.rect,
      status: "loading",
      originalText: currentContext.text,
      provider: nextProvider
    });

    try {
      chrome.runtime.sendMessage(
        {
          type: config.messages.updateProvider,
          payload: { provider: nextProvider }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            renderRuntimeError(currentContext.rect, currentContext.text, chrome.runtime.lastError.message);
            return;
          }

          if (!response || !response.ok) {
            renderPopup({
              rect: currentContext.rect,
              status: "error",
              originalText: currentContext.text,
              provider: nextProvider,
              error: response ? response.error : { code: "unknown-error", message: "切换翻译服务失败，请稍后重试。" }
            });
            return;
          }

          state.settings = {
            ...state.settings,
            provider: response.payload.provider
          };
          requestTranslation(currentContext.text, currentContext.rect, {
            providerOverride: response.payload.provider
          });
        }
      );
    } catch (error) {
      renderRuntimeError(currentContext.rect, currentContext.text, error && error.message ? error.message : "");
    }
  }

  function positionElement(element, rect, options) {
    const offsetY = options.offsetY || 0;
    const isFixed = element.classList.contains("linguapop-popup");
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const elementWidth = element.offsetWidth || (isFixed ? 360 : 260);
    const elementHeight = element.offsetHeight || 180;
    const preferredLeft = options.preferLeftAligned ? rect.left : rect.left + rect.width / 2 - elementWidth / 2;
    const left = Math.max(12, Math.min(preferredLeft, viewportWidth - elementWidth - 12));
    const bottomTop = rect.bottom + offsetY;
    const topTop = rect.top - elementHeight - offsetY;
    let viewportTop = bottomTop;

    if (bottomTop + elementHeight > viewportHeight - 12 && topTop >= 12) {
      viewportTop = topTop;
    } else if (bottomTop + elementHeight > viewportHeight - 12) {
      viewportTop = Math.max(12, viewportHeight - elementHeight - 12);
    }

    element.style.left = `${left + (isFixed ? 0 : scrollX)}px`;
    element.style.top = `${viewportTop + (isFixed ? 0 : scrollY)}px`;
  }

  function positionElementByCoordinates(element, left, top) {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const elementWidth = element.offsetWidth || 360;
    const elementHeight = element.offsetHeight || 180;
    const nextLeft = Math.max(12, Math.min(left, viewportWidth - elementWidth - 12));
    const nextTop = Math.max(12, Math.min(top, viewportHeight - elementHeight - 12));

    const isFixed = element.classList.contains("linguapop-popup");
    element.style.left = `${nextLeft + (isFixed ? 0 : window.scrollX)}px`;
    element.style.top = `${nextTop + (isFixed ? 0 : window.scrollY)}px`;
  }

  function stopOverlayEvent(event) {
    event.stopPropagation();
  }

  function onHeaderDragStart(event) {
    if (!state.popupElement || isInteractiveHeaderControl(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const popupRect = state.popupElement.getBoundingClientRect();
    state.dragState = {
      offsetX: event.clientX - popupRect.left,
      offsetY: event.clientY - popupRect.top
    };
    state.popupElement.classList.add("linguapop-popup-dragging");
  }

  function onDocumentMouseMove(event) {
    if (!state.dragState || !state.popupElement) {
      return;
    }

    event.preventDefault();
    positionElementByCoordinates(
      state.popupElement,
      event.clientX - state.dragState.offsetX,
      event.clientY - state.dragState.offsetY
    );
  }

  function onDocumentMouseUp() {
    if (!state.dragState || !state.popupElement) {
      state.dragState = null;
      return;
    }

    state.popupElement.classList.remove("linguapop-popup-dragging");
    state.dragState = null;
  }

  function renderRuntimeError(rect, text, runtimeMessage) {
    const isInvalidated = isExtensionContextInvalidated(runtimeMessage);
    renderPopup({
      rect,
      status: "error",
      originalText: text,
      error: {
        code: isInvalidated ? "extension-context-invalidated" : "runtime-error",
        message: isInvalidated ? "扩展已更新，请刷新当前页面后重试。" : "网络异常，请稍后重试。"
      }
    });
  }

  function isEventInsideOverlay(event) {
    return Boolean(findOverlayRoot(event.target));
  }

  function isSelectionInsideOverlay(selection) {
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const anchorInside = isNodeInsideOverlay(selection.anchorNode);
    const focusInside = isNodeInsideOverlay(selection.focusNode);
    const commonInside = range ? isNodeInsideOverlay(range.commonAncestorContainer) : false;
    return anchorInside || focusInside || commonInside;
  }

  function isNodeInsideOverlay(node) {
    return Boolean(findOverlayRoot(node));
  }

  function isInteractiveHeaderControl(node) {
    return Boolean(
      node
      && node.closest
      && node.closest(".linguapop-provider, .linguapop-close, .linguapop-settings")
    );
  }

  function findOverlayRoot(node) {
    let current = node instanceof Element ? node : node && node.parentElement;
    while (current) {
      if (current.dataset && current.dataset.linguapopOverlay) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function isExtensionContextInvalidated(errorOrMessage) {
    const message = typeof errorOrMessage === "string"
      ? errorOrMessage
      : errorOrMessage && errorOrMessage.message;
    return typeof message === "string" && message.includes("Extension context invalidated");
  }

  function onDocumentMouseDown(event) {
    const target = event.target;
    if (state.popupElement && state.popupElement.contains(target)) {
      return;
    }
    if (state.buttonElement && state.buttonElement.contains(target)) {
      return;
    }
    closeButton();
  }

  function clearTransientUi() {
    closeButton();
    closePopup();
  }

  function closeButton() {
    if (state.buttonElement) {
      state.buttonElement.remove();
      state.buttonElement = null;
    }
  }

  function closePopup() {
    if (state.popupElement) {
      state.popupElement.classList.remove("linguapop-popup-dragging");
      state.popupElement.remove();
      state.popupElement = null;
    }
    state.dragState = null;
  }
})(window);
