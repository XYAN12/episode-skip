# Skipisode 中文说明

Skipisode 是一个基于 Manifest V3 的 Chrome / Brave 扩展，用来在 YouTube 观看页面保存并自动应用片头、片尾跳过规则。它特别适合反复观看剧集、综艺或系列视频的场景，因为同一系列内容的片头和片尾通常比较稳定。

## 文档导航

- [本地测试说明](./local-testing.md)
- [使用教程（英文）](./how-to-use.md)
- [使用教程（中文）](./how-to-use.zh-CN.md)
- [英文 README](../README.md)

## 项目目的

这个项目主要解决的是重复观看 YouTube 剧集内容时，用户需要手动反复跳过片头和片尾的问题。Skipisode 允许用户保存可复用的跳过规则，并在之后自动应用。

它的核心目标包括：

- 为单个视频保存片头结束时间。
- 以“剩余时长”的方式保存片尾规则，提高不同视频时长下的复用性。
- 支持视频、播放列表和频道等不同层级的规则复用。

## 主要功能

- 在 YouTube 页面内显示可拖拽的圆形 `Skip` 按钮
- 通过页内控制面板保存片头和片尾规则
- 自动跳过已保存的片头和片尾
- 自动识别当前页面所属的播放列表
- 一键把当前视频规则应用到播放列表
- 记住悬浮按钮的位置

## 快速开始

1. 安装依赖：

```bash
npm install
```

2. 运行测试：

```bash
npm test
```

3. 构建扩展：

```bash
npm run build
```

4. 在 Chrome 或 Brave 中把 `dist/` 作为 unpacked extension 加载。

详细步骤请查看 [本地测试说明](./local-testing.md)。

## 项目结构

```text
episode-skip/
├── design/                  设计参考图和原型
├── dist/                    构建后的扩展产物
├── docs/                    项目文档
├── logo/                    Logo 和图标资源
├── scripts/                 校验和辅助脚本
├── src/                     源代码
│   ├── content.ts           内容脚本与页内 UI 编排
│   ├── rules.ts             规则匹配与跳过计算逻辑
│   ├── storage.ts           `chrome.storage.local` 持久化封装
│   ├── ui-position.ts       悬浮按钮位置计算与边界限制
│   ├── ui-state.ts          面板展示和状态格式化
│   └── youtube.ts           YouTube 页面上下文解析
├── tests/                   Vitest 单元测试
├── manifest.json            Manifest V3 配置
├── package.json             脚本和依赖定义
├── tsconfig.json            TypeScript 配置
└── vite.config.ts           Vite 构建配置
```

## 技术栈

- TypeScript
- Vite
- Vitest
- Chrome Extension Manifest V3
- `chrome.storage.local`

## 规则优先级

规则按以下顺序匹配：

1. 视频级规则
2. 播放列表级规则
3. 频道级规则
4. 无匹配规则

也就是说，针对某一条视频手动保存的规则，优先级永远高于更宽泛的播放列表或频道规则。

## 当前限制

- 目前只支持标准 YouTube watch 页面。
- 频道识别依赖页面中可稳定读取的频道元数据。
- 现在的页内面板主要覆盖视频和播放列表规则的创建流程。

## 后续方向

- 在页内面板中直接编辑频道规则
- 支持规则导入和导出
- 增加选项页来查看和删除已保存规则
- 增强异常页面状态下的诊断能力
