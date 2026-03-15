# Android LSP

为 Android/Kotlin 开发提供的综合工具包，支持 VSCode 和其他编辑器的 Language Server Protocol (LSP)。

[English Documentation](README.md)

## 概述

Android LSP 是 [JetBrains Kotlin LSP](https://github.com/JetBrains/kotlin-lsp) 的分支和增强版本，集成了额外的 Android 开发工具。它为 Kotlin/Android 项目提供智能代码补全、导航、重构和调试支持。

## 项目结构

```
android-lsp/
├── core/                          # 核心组件
│   ├── adt/                       # Android 开发工具
│   │   ├── adt-cli/               # 命令行接口
│   │   ├── tools-android/         # Android 工具库
│   │   ├── workspace-kotlin/      # Kotlin 工作区支持
│   │   └── test-fixtures/         # 测试项目
│   │
│   └── kotlin-lsp/                # JetBrains Kotlin LSP (分支)
│       ├── kotlin-lsp/            # LSP 服务器实现
│       ├── kotlin-vscode/         # 原始 VSCode 扩展
│       ├── workspace-import/      # 工作区导入工具
│       └── scripts/               # 编辑器集成脚本
│
└── vscode-plugin/                 # 增强的 VSCode 插件
    └── android-lsp/               # Android LSP 扩展
```

## 功能特性

### VSCode 扩展

- ✅ **自动识别 Android 项目** - 检测 Gradle 配置和 AndroidManifest.xml
- ✅ **自动生成 workspace.json** - 使用 ADT CLI 解析 Android 项目依赖
- ✅ **Compose 编译器插件支持** - 自动解析 Compose 编译器插件
- ✅ **源码 JAR 附加** - 从 Gradle 缓存附加源码 JAR，提供更好的 IDE 体验
- ✅ **代码补全** - Kotlin/Android 智能代码补全
- ✅ **代码导航** - 跳转到定义、查找引用
- ✅ **代码重构** - 重命名、提取方法等
- ✅ **调试支持** - Kotlin/Android 程序调试
- ✅ **开箱即用** - 内嵌 Kotlin LSP Server 和 JRE

### ADT CLI

- ✅ **工作区生成** - 为 Kotlin LSP 生成 workspace.json
- ✅ **项目解析** - 解析 Gradle/Maven 依赖
- ✅ **多模块支持** - 处理复杂的多模块项目
- ✅ **Compose 支持** - 自动解析 Compose 编译器插件

## 快速开始

### VSCode 扩展

详细安装和使用说明请参阅 [vscode-plugin/android-lsp/README.md](vscode-plugin/android-lsp/README.md)。

### ADT CLI

```bash
# 构建 ADT CLI
cd core/adt
./gradlew :adt-cli:installDist

# 生成 workspace.json
./adt-cli/build/install/adt-cli/bin/adt-cli workspace /path/to/android/project --output workspace.json
```

## 组件说明

### 1. VSCode 扩展

位于 `vscode-plugin/android-lsp/` 的增强版 VSCode 扩展提供：

- 与 Kotlin LSP Server 集成
- ADT CLI 集成用于 workspace.json 生成
- Android 项目检测和配置

[→ VSCode 扩展文档](vscode-plugin/android-lsp/README.md)

### 2. ADT (Android Development Tools)

用于 Android 项目分析和工作区生成的一组工具。

[→ ADT 文档](core/adt/README.md)

### 3. Kotlin LSP Server

从 JetBrains Kotlin LSP 分支，针对 Android 开发进行了增强。

[→ Kotlin LSP 文档](core/kotlin-lsp/README.md)

## 环境要求

- **Java 21+** - ADT CLI 和 Kotlin LSP Server 需要
- **Node.js 22+** - VSCode 扩展开发需要
- **Gradle 8.x** - 构建 ADT CLI 需要

## 许可证

本项目采用 **GNU Lesser General Public License v3.0 (LGPL-3.0)** 许可证。

本项目包含以下代码：
- **kotlin-vscode** (Apache 2.0) - Copyright JetBrains s.r.o.
- **Kotlin LSP Server** (Apache 2.0) - Copyright JetBrains s.r.o.
- **ADT** (LGPL-3.0) - Copyright yamsergey

详见 [THIRD-PARTY-NOTICES](vscode-plugin/android-lsp/THIRD-PARTY-NOTICES)。

## 贡献

欢迎贡献代码！提交 Pull Request 前请阅读贡献指南。

## 致谢

- [JetBrains](https://www.jetbrains.com/) 提供原始 Kotlin LSP 实现
- [yamsergey](https://github.com/yamsergey/yamsergey.adt) 提供 ADT 项目
- [Kotlin LSP Issue #97](https://github.com/Kotlin/kotlin-lsp/issues/97#issuecomment-3957021983) 提供 Compose 编译器插件灵感

## 链接

- [VSCode 扩展 README](vscode-plugin/android-lsp/README.md)
- [ADT README](core/adt/README.md)
- [Kotlin LSP README](core/kotlin-lsp/README.md)
- [English Documentation](README.md)
