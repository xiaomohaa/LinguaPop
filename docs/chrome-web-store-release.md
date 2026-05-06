# Chrome Web Store 发布文案

## Store Name

LinguaPop

## Short Description

Translate selected text on any webpage with a floating popup or context menu.

## Short Description (中文)

在任意网页中划词翻译，支持悬浮弹窗和右键菜单触发。

## Detailed Description

LinguaPop is a lightweight Chrome extension for selection-based translation.

Select text on any webpage and translate it instantly with a clean popup card, or trigger translation from the right-click menu. LinguaPop is designed for fast reading workflows and supports both English-Chinese and Chinese-English translation.

### Features

- Translate selected text directly on the page
- Support both automatic popup mode and button-trigger mode
- Right-click menu translation as a fallback entry
- Switch between Tencent Cloud Translation and Baidu Translation
- Detect language direction automatically for English and Chinese
- Clean in-page translation card with source text and translated text

### Notes

- Before using the extension, you need to configure translation credentials in the options page
- Selected text is sent to the translation provider you choose only for translation

## Detailed Description (中文)

LinguaPop 是一个轻量的 Chrome 划词翻译插件。

你可以在任意网页中选中文本，直接通过页面内弹窗查看翻译结果，也可以通过右键菜单触发翻译。它面向高频阅读场景，支持中英双向翻译，并提供更顺滑的网页内交互。

### 功能特点

- 在网页中直接划词翻译
- 支持自动弹窗模式和按钮触发模式
- 支持右键菜单作为备用入口
- 支持在腾讯云翻译与百度翻译之间切换
- 自动识别中英文方向
- 页面内展示简洁翻译卡片，只显示原文和译文

### 使用说明

- 首次使用前，需要在插件设置页填写翻译服务凭证
- 用户选中的文本只会发送到你选择的翻译服务，用于完成翻译请求

## Privacy Disclosure Draft

### Single-purpose description

This extension translates text selected by the user on webpages.

### What data is handled

- User-selected text on webpages
- Extension settings, including selected translation provider and locally stored provider credentials

### How data is used

- Selected text is sent to the user-configured translation provider only to return a translation result
- Settings are stored locally in Chrome extension storage so the extension can remember user preferences

### What is not done

- No account system
- No advertising
- No analytics or behavioral tracking
- No sale of user data

## Privacy Tab Suggested Answers

Use these as a starting point and verify them against the final implementation before submission.

- Personal or sensitive user data:
  - `User activity`
  - Reason: user-selected webpage text is processed for translation
- Data is collected:
  - `Yes`, only to provide the translation feature
- Data is sold:
  - `No`
- Data is used for purposes unrelated to the item's core functionality:
  - `No`
- Data is handled securely:
  - `Yes`, in transit to the configured provider

## Screenshot Suggestions

- Options page with provider selection and credential fields
- Selection translation popup on an English webpage
- Selection translation popup on a Chinese webpage
- Provider switch in popup header

## Submission Checklist

- `manifest.json` version is correct
- Icons `16/32/48/128` are present
- Zip package contains `manifest.json` at the root
- Provider credentials are tested locally
- Store listing and privacy form are filled out
- Screenshots are prepared
