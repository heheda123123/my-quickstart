# my-quickstart

[English](README.md)

一个基于 Tauri + Vue 3 + SQLite 的轻量级 Windows 启动器。

## 功能

- 左侧分组标签，右侧应用卡片
- 单击启动，右键菜单操作
- 支持拖拽文件添加应用
- 搜索时跨分组查找
- 可在设置中调整布局、字体、热键与行为
- 使用 SQLite 持久化数据

## 使用说明

- 点击左侧分组切换应用列表。
- 在空白处右键可添加应用/分组。
- 右键应用卡片可编辑、打开所在文件夹或移除。
- 拖拽文件到窗口内可添加应用。
- 双击空白处可隐藏窗口（可在设置中关闭）。

## 快捷键

- Ctrl/Cmd+F：聚焦搜索框
- Esc：搜索框聚焦时清空搜索

## 数据存储

- SQLite 数据库：`%LOCALAPPDATA%\my-quickstart\launcher.db`

## 截图

![主界面](image.png)

![右键菜单](image-1.png)

## 开发

### 仅前端界面

```
pnpm install
pnpm dev
```

### 桌面端 (Tauri)

```
pnpm install
pnpm tauri dev
```

## 构建

当前主要在 Windows 上测试。

```
pnpm install
pnpm tauri build --no-bundle
```
