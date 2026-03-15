# Android LSP

一个为 Android/Kotlin 项目提供语言支持的 VSCode 插件，集成 JetBrains Kotlin LSP 和 ADT (Android Development Tools)。

## 功能特性

- ✅ **自动识别 Android 项目** - 检测 Gradle 配置和 AndroidManifest.xml
- ✅ **自动生成 workspace.json** - 使用 ADT CLI 解析 Android 项目依赖
- ✅ **代码补全** - Kotlin/Android 代码智能补全
- ✅ **代码导航** - 跳转到定义、引用查找
- ✅ **代码重构** - 重命名、提取方法等
- ✅ **调试支持** - Kotlin/Android 程序调试
- ✅ **开箱即用** - 内嵌 Kotlin LSP Server 和 JRE

## 目录结构

```
android-lsp/
├── src/                    # TypeScript 源代码
│   ├── extension.ts        # 插件入口
│   ├── lspClient.ts        # LSP 客户端
│   ├── projectDetector.ts  # Android 项目检测
│   ├── adtManager.ts       # ADT CLI 管理
│   └── workspaceGenerator.ts # workspace.json 生成
├── server/                 # Kotlin LSP Server (打包时生成)
├── adt-cli/                # ADT CLI 工具 (打包时复制)
├── dist/                   # 编译输出
├── syntaxes/               # Kotlin 语法高亮
└── icons/                  # 图标资源
```

## 编译方式

### 环境要求

- Node.js 22.x 或更高版本
- npm 10.x 或更高版本
- Java 21+ (用于 ADT CLI)

### 安装依赖

```bash
cd vscode-plugin/android-lsp
npm install
```

### 开发编译

```bash
npm run compile
```

### 生产编译

```bash
npm run package
```

### 打包 VSIX

打包前需要准备以下内容：

#### 1. 准备 Kotlin LSP Server

下载或指定 Kotlin LSP Server zip 文件路径：

```bash
export LSP_ZIP_PATH="/path/to/kotlin-lsp-xxx.zip"
```

#### 2. 准备 ADT CLI

从 ADT 项目构建并复制 ADT CLI：

```bash
# 构建 ADT CLI
cd /path/to/adt/project
./gradlew :adt-cli:installDist

# 复制到插件目录
cp -r adt-cli/build/install/adt-cli /path/to/android-lsp/vscode-plugin/android-lsp/

# 添加执行权限
chmod +x /path/to/android-lsp/vscode-plugin/android-lsp/adt-cli/bin/adt-cli
```

#### 3. 执行打包

```bash
# 设置 LSP Server 路径
export LSP_ZIP_PATH="/path/to/kotlin-lsp-xxx.zip"

# 打包
npx @vscode/vsce package 1.0.0 --out android-lsp-1.0.0.vsix
```

或使用打包脚本：

```bash
./package.sh 1.0.0
```

## 工作原理

### 架构流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Android LSP 插件启动                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 项目检测 (projectDetector.ts)                               │
│     - 检查 build.gradle / settings.gradle                       │
│     - 检查 AndroidManifest.xml                                  │
│     - 判断是否为 Android 项目                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────────┐   ┌───────────────┐
            │  Android 项目  │   │  纯 Kotlin 项目 │
            └───────────────┘   └───────────────┘
                    │                   │
                    ▼                   │
┌─────────────────────────────────────┐│
│  2. 生成 workspace.json (ADT CLI)   ││
│     - 解析 Gradle 依赖              ││
│     - 生成模块信息                  ││
│     - 保存到项目根目录              ││
└─────────────────────────────────────┘│
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 启动 Kotlin LSP Server                                       │
│     - 使用内嵌的 kotlin-lsp.sh                                   │
│     - 读取 workspace.json (Android 项目)                         │
│     - 提供 LSP 服务                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. LSP 功能                                                     │
│     - 代码补全                                                   │
│     - 代码导航                                                   │
│     - 代码重构                                                   │
│     - 错误诊断                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 文件 | 功能 |
|------|------|------|
| 项目检测 | `projectDetector.ts` | 检测项目类型 (Android/Kotlin) |
| ADT 管理 | `adtManager.ts` | 调用 ADT CLI 生成 workspace.json |
| 工作区生成 | `workspaceGenerator.ts` | 管理 workspace.json 生成 |
| LSP 客户端 | `lspClient.ts` | 启动和管理 Kotlin LSP Server |
| 状态栏 | `statusBar.ts` | 显示 LSP 状态和项目类型 |

## 安装后配置

### 自动配置 (无需用户操作)

以下功能开箱即用：

- ✅ Kotlin LSP Server (内嵌)
- ✅ JRE 运行时 (内嵌)
- ✅ Kotlin 语法高亮
- ✅ 项目自动检测

### 需要用户配置

#### 1. ADT CLI 权限 (macOS/Linux)

首次安装后，需要赋予 ADT CLI 执行权限：

```bash
chmod +x ~/.vscode/extensions/android-lsp.android-lsp-*/adt-cli/bin/adt-cli
```

#### 2. Java 21+ 环境

ADT CLI 需要 Java 21 或更高版本：

```bash
# 检查 Java 版本
java -version

# 如果没有安装，请安装 Java 21+
# macOS:
brew install openjdk@21
```

#### 3. 可选配置项

在 VSCode 设置中可以配置：

```json
{
  // ADT CLI 路径 (默认使用内嵌版本)
  "androidLSP.adtCliPath": null,
  
  // JDK 路径 (符号解析)
  "androidLSP.jdkForSymbolResolution": null,
  
  // 额外 JVM 参数
  "androidLSP.additionalJvmArgs": []
}
```

## 命令

| 命令 | 说明 |
|------|------|
| `Android LSP: Generate workspace.json` | 手动生成 workspace.json |
| `Android LSP: Restart LSP` | 重启 LSP Server |
| `Android LSP: Sync Gradle` | 同步 Gradle 并重新生成 workspace.json |

## 故障排除

### LSP 启动失败

1. 检查 Kotlin LSP Server 权限：
```bash
chmod +x ~/.vscode/extensions/android-lsp.android-lsp-*/server/kotlin-lsp.sh
```

2. 移除 macOS 隔离属性：
```bash
xattr -cr ~/.vscode/extensions/android-lsp.android-lsp-*/
```

### workspace.json 生成失败

1. 确认 Java 21+ 已安装：
```bash
java -version
```

2. 确认 ADT CLI 有执行权限：
```bash
chmod +x ~/.vscode/extensions/android-lsp.android-lsp-*/adt-cli/bin/adt-cli
```

3. 手动运行 ADT CLI 测试：
```bash
~/.vscode/extensions/android-lsp.android-lsp-*/adt-cli/bin/adt-cli workspace /path/to/android/project
```

### 项目未被识别为 Android 项目

确保项目包含以下文件之一：
- `build.gradle` 或 `build.gradle.kts` (包含 `com.android.application` 插件)
- `app/src/main/AndroidManifest.xml`

## 许可证

本项目采用 GNU Lesser General Public License v3.0 (LGPL-3.0) 许可证。

本项目包含以下第三方组件：

| 组件 | 许可证 | 版权方 |
|------|--------|--------|
| kotlin-vscode | Apache 2.0 | JetBrains s.r.o. |
| Kotlin LSP Server | Apache 2.0 | JetBrains s.r.o. |
| ADT | LGPL-3.0 | yamsergey |

详见 [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES) 文件。

### 源代码获取

本项目使用的第三方库源代码可从以下地址获取：

- kotlin-vscode: https://github.com/JetBrains/kotlin-vscode
- Kotlin LSP Server: https://github.com/JetBrains/kotlin-lsp
- ADT: https://github.com/yamsergey/adt

### 替换 ADT CLI 版本

如果您想使用不同版本的 ADT CLI：

1. 下载所需版本：https://github.com/yamsergey/adt/releases
2. 替换 `adt-cli/` 目录
3. 重启 VSCode
