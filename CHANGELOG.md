# Android LSP Changelog

## v1.0.0-alpha.2

### Kotlin LSP Version
Bundled Kotlin LSP: v262.4739.0

### What's Changed

Sync kotlin-lsp upstream ([88c0d4e3..43094d7f](https://github.com/Kotlin/kotlin-lsp/compare/88c0d4e3..43094d7f), 161 commits)

#### 🛠 LSP capabilities

- **Call hierarchy** (`textDocument/prepareCallHierarchy`, `callHierarchy/incomingCalls`, `callHierarchy/outgoingCalls`) — invoke "Show Call Hierarchy" / "Show Incoming/Outgoing Calls" on a Kotlin function or property to see who calls it and which symbols it calls. (LSP-487)
- **Code folding** (`textDocument/foldingRange`) — Kotlin function and class bodies, blocks, imports, and multiline comments can now be collapsed in the editor. (LSP-655)
- **Smart insertion of parentheses, braces, and quotes** — auto-pairing and overtyping work for KDoc brackets, string templates, raw strings, generic angle brackets, `when` / lambda braces, and char literals. (LSP-283)
- **File templates** (IntelliJ-style) — newly created Kotlin files are generated from configurable templates that support predefined variables and conditional expressions. Templates are configured through VS Code settings. (LSP-814)
- Extract variable/method refactoring (Java) (LSP-819, LSP-787)
- SQL inlays support (DBE-24976)
- Licensing support (LSP-723)

#### 🐛 Bug fixes

- `override` completion no longer throws an exception on methods that carry annotations (LSP-798, LSP-1031)
- Kotlin compiler settings (including compiler plugins like Compose) are now correctly computed for non-standard Gradle source sets (LSP-835)
- Cross-language references in mixed Kotlin/Java projects with non-standard Gradle source sets are now resolved correctly
- Fix suppressions ignored in LSP (LSP-1010)
- Fix PROJECT_NAME interpolation in file templates (LSP-998)
- Fix Enter key handling, disable default auto-indentation (LSP-994, LSP-988)
- Temporary disable UnusedSymbolInspection for Kotlin LSP (LSP-1005)
- Blacklist commonly occurring Kotlin fixes in LSP (LSP-950, LSP-970)
- Fix TypeError in onDidChangeTextDocument handler (LSP-959)
- Show import progress in VS Code (LSP-948)
- Fix missing syntax errors in out-of-source-roots java files (LSP-946)
- Fix NullPointerException in ElementManipulator (LSP-943)
- Fix FIR cache invalidation after file deletion (LSP-937)
- Fix source/resource roots intersection in same module (LSP-913)
- Fix duplicate symbols (LSP-142)
- Fix quickfix move-to-package failure (LSP-868)
- Fix textDocument/references returning irrelevant items (LSP-815)
- Make imported paths consistent with workspace root (LSP-824)

#### 🧪 Experimental features

> ⚠️ The features listed in this section are not finalized. They may contain bugs and are likely to change significantly in future releases.

- **Import of Android projects** is now supported — variant selection, source set resolution, R.jar resolution, nested components import, and active variant selection from environment variable. (LSP-842, LSP-863, LSP-860)
- Use associate compilations from Kotlin to infer friendship dependencies (LSP-732)

#### Other

- 🚀 Index storage migrated to RocksDB — more robust state management and better performance. (LSP-662)
- VS Code extension settings renamed from `kotlinLSP.*` to `intellij.*`. (LSP-807)
- New `intellij.buildTool` setting controls which build-system importer should be preferred. (LSP-807)
- 📦 New bundling layout — use the `bin/intellij-server` executable to launch the standalone server. The legacy `kotlin-lsp.sh` launcher is deprecated. (LSP-884)
- `stdio` mode stability — the JVM's own stdout is now isolated from the LSP framing channel. (LSP-817)
- ⚠️ Kotlin LSP now requires JDK 25 to run. (IJPL-221307)
- Remove old KotlinLspServer monolithic entry point
- Remove EditorConfig module
- Rename LightWorkspaceImporter to GenericWorkspaceImporter
- Refactor completion provider to use LSCompletionProviderHelper
- Improve Gradle workspace import (dependency resolution, content root resolution, Java level calculation)

### Downloads

| Platform | File |
|----------|------|
| macOS (Intel) | `android-lsp-darwin-x64.vsix` |
| macOS (Apple Silicon) | `android-lsp-darwin-arm64.vsix` |
| Linux (x64) | `android-lsp-linux-x64.vsix` |
| Linux (ARM64) | `android-lsp-linux-arm64.vsix` |
| Windows (x64) | `android-lsp-win32-x64.vsix` |
| Windows (ARM64) | `android-lsp-win32-arm64.vsix` |

### Installation

1. Download the `.vsix` file for your platform
2. Open VS Code
3. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
4. Type "Install from VSIX" and select the downloaded file

### Requirements

- VS Code 1.96.0 or higher
- Java 25 or higher (for running the language server)

## v1.0.0-alpha.1

### Kotlin LSP Version
Bundled Kotlin LSP: v262.1817.0

### Downloads

| Platform | File |
|----------|------|
| macOS (Intel) | `android-lsp-darwin-x64.vsix` |
| macOS (Apple Silicon) | `android-lsp-darwin-arm64.vsix` |
| Linux (x64) | `android-lsp-linux-x64.vsix` |
| Linux (ARM64) | `android-lsp-linux-arm64.vsix` |
| Windows (x64) | `android-lsp-win32-x64.vsix` |
| Windows (ARM64) | `android-lsp-win32-arm64.vsix` |

### Installation

1. Download the `.vsix` file for your platform
2. Open VS Code
3. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
4. Type "Install from VSIX" and select the downloaded file

### Requirements

- VS Code 1.96.0 or higher
- Java 21 or higher (for running the language server)
