# KHInsider Downloader RN

一个用于从 [KHInsider](https://downloads.khinsider.com) 批量下载游戏原声音乐专辑的 React Native 应用。

## 功能

- 输入 KHInsider 专辑链接，自动解析并下载全部曲目
- 优先下载 FLAC 格式，无 FLAC 时回退到 MP3
- 可调节并发线程数（1-8）
- 自动重试失败任务（最多 5 次，递增延时）
- 实时显示下载进度、速度、已下载大小和耗时
- 自定义保存路径
- 跳过已存在的文件，支持断点续传

## 截图

<!-- 在此添加应用截图 -->

## 环境要求

- Node.js >= 22.11.0
- React Native 0.84
- Android SDK / Xcode（取决于目标平台）

## 安装

```bash
git clone <repo-url>
cd KHInsiderDownloaderRN
npm install
```

### iOS

```bash
bundle install
bundle exec pod install
npm run ios
```

### Android

```bash
npm run android
```

## 使用方法

1. 打开应用
2. 粘贴 KHInsider 专辑链接（如 `https://downloads.khinsider.com/game-soundtracks/album/...`）
3. 选择保存路径和并发线程数
4. 点击「开始下载」

## 项目结构

```
src/
├── components/
│   ├── FileListItem.tsx    # 文件列表项组件
│   └── ProgressBar.tsx     # 进度条组件
├── hooks/
│   └── useDownload.ts      # 下载状态管理 Hook
├── screens/
│   └── HomeScreen.tsx      # 主界面
├── services/
│   └── DownloadService.ts  # 下载核心逻辑（解析、并发下载、重试）
├── theme.ts                # 主题色定义
└── utils.ts                # 格式化工具函数
```

## 技术栈

- React Native 0.84 + TypeScript
- [cheerio](https://github.com/cheeriojs/cheerio) — HTML 解析
- [react-native-fs](https://github.com/itinance/react-native-fs) — 文件系统操作
- [@react-native-documents/picker](https://github.com/react-native-documents/picker) — 目录选择器

## License

[MIT](LICENSE)
