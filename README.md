# Quick Launcher (Tauri + Vue3)

一个类似 Maye Lite 的快速启动工具雏形：左侧分组（Tab），右侧应用卡片，点击卡片启动应用；支持右键空白处添加与文件拖拽导入。

## Features

- Groups (tabs) on the left
- App cards grid on the right
- Click a card to launch via `@tauri-apps/plugin-opener`
- Right click blank area to add apps / groups
- Drag files into the window to add to the active group
- Local persistence via `localStorage`

## Dev

```bash
pnpm install
pnpm tauri dev
```

If you are missing desktop prerequisites (Rust / WebKit, etc.), follow the official Tauri prerequisites guide first.
