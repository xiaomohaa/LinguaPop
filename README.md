# LinguaPop

一个基于 Chrome Manifest V3 的划词翻译插件。

## 当前能力

- 网页划词后自动翻译
- 可切换为“小按钮触发”模式
- 支持右键菜单翻译
- 自动在中文和英文之间切换目标语言
- 设置页可选 `腾讯云机器翻译` 或 `百度翻译`

## 发布准备

- 已包含扩展图标：`16 / 32 / 48 / 128`
- `manifest.json` 已声明扩展图标与所需权限
- 上传到 Chrome Web Store 时，需要将项目根目录内容打成 zip，且 `manifest.json` 必须位于 zip 根目录
- 发布前请在商店后台补齐：
  - 图标、截图、简介、详细描述
  - Privacy 表单
  - 如实说明选中文本会发送到腾讯云或百度翻译以完成翻译

## 本地加载

1. 打开 Chrome 的扩展管理页：`chrome://extensions`
2. 打开右上角“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择当前目录 `/Users/guangxin/xiaomo/LLM/code/LinguaPop`

## 使用方式

1. 进入扩展的“详细信息”页，打开“扩展程序选项”
2. 先选择翻译服务
3. 如果选腾讯云，填写 `SecretId`、`SecretKey`，默认 `Region` 为 `ap-guangzhou`，`ProjectId` 为 `0`
4. 如果选百度翻译，填写 `App ID` 和 `Secret Key`
5. 在普通网页中选中文本
6. 默认会自动弹出翻译卡片；如果在设置页切到“小按钮触发”，则先点 `译` 按钮再翻译
7. 也可以通过右键菜单“翻译所选内容”触发

## 目录结构

- `manifest.json`: 扩展入口配置
- `src/background`: 右键菜单、消息处理、翻译 provider
- `src/content`: 划词监听、悬浮按钮、翻译卡片
- `src/options`: 设置页
- `src/shared`: 常量和存储封装

## 当前约束

- 第一版支持腾讯云机器翻译 `TextTranslate` 和百度翻译通用文本翻译
- 只显示原文和译文
- 目前没有自动化测试脚本

## 说明

- 当前版本程序由 OpenAI Codex 协助编写与迭代
