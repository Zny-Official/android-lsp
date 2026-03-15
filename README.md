# Android LSP

A comprehensive toolkit for Android/Kotlin development, providing Language Server Protocol (LSP) support for VSCode and other editors.

[中文文档](README_CN.md)

## Overview

Android LSP is a fork and enhancement of [JetBrains Kotlin LSP](https://github.com/JetBrains/kotlin-lsp) with additional Android development tools integration. It provides intelligent code completion, navigation, refactoring, and debugging support for Kotlin/Android projects.

## Project Structure

```
android-lsp/
├── core/                          # Core components
│   ├── adt/                       # Android Development Tools
│   │   ├── adt-cli/               # Command-line interface
│   │   ├── tools-android/         # Android tools library
│   │   ├── workspace-kotlin/      # Kotlin workspace support
│   │   └── test-fixtures/         # Test projects
│   │
│   └── kotlin-lsp/                # JetBrains Kotlin LSP (forked)
│       ├── kotlin-lsp/            # LSP server implementation
│       ├── kotlin-vscode/         # Original VSCode extension
│       ├── workspace-import/      # Workspace import utilities
│       └── scripts/               # Editor integration scripts
│
└── vscode-plugin/                 # Enhanced VSCode plugin
    └── android-lsp/               # Android LSP extension
```

## Features

### VSCode Extension

- ✅ **Automatic Android Project Detection** - Detects Gradle configuration and AndroidManifest.xml
- ✅ **Automatic workspace.json Generation** - Uses ADT CLI to parse Android project dependencies
- ✅ **Compose Compiler Plugin Support** - Automatic resolution of Compose compiler plugin
- ✅ **Source JAR Attachment** - Attaches source JARs from Gradle cache for better IDE experience
- ✅ **Code Completion** - Intelligent Kotlin/Android code completion
- ✅ **Code Navigation** - Go to definition, find references
- ✅ **Code Refactoring** - Rename, extract method, etc.
- ✅ **Debug Support** - Kotlin/Android program debugging
- ✅ **Out of the Box** - Bundled Kotlin LSP Server and JRE

### ADT CLI

- ✅ **Workspace Generation** - Generate workspace.json for Kotlin LSP
- ✅ **Project Resolution** - Parse Gradle/Maven dependencies
- ✅ **Multi-module Support** - Handle complex multi-module projects
- ✅ **Compose Support** - Automatic Compose compiler plugin resolution

## Quick Start

### VSCode Extension

See [vscode-plugin/android-lsp/README.md](vscode-plugin/android-lsp/README.md) for detailed installation and usage instructions.

### ADT CLI

```bash
# Build ADT CLI
cd core/adt
./gradlew :adt-cli:installDist

# Generate workspace.json
./adt-cli/build/install/adt-cli/bin/adt-cli workspace /path/to/android/project --output workspace.json
```

## Components

### 1. VSCode Extension

The enhanced VSCode extension located in `vscode-plugin/android-lsp/` provides:

- Integration with Kotlin LSP Server
- ADT CLI integration for workspace.json generation
- Android project detection and configuration

[→ VSCode Extension Documentation](vscode-plugin/android-lsp/README.md)

### 2. ADT (Android Development Tools)

A set of tools for Android project analysis and workspace generation.

[→ ADT Documentation](core/adt/README.md)

### 3. Kotlin LSP Server

Forked from JetBrains Kotlin LSP with enhancements for Android development.

[→ Kotlin LSP Documentation](core/kotlin-lsp/README.md)

## Requirements

- **Java 21+** - Required for ADT CLI and Kotlin LSP Server
- **Node.js 22+** - Required for VSCode extension development
- **Gradle 8.x** - For building ADT CLI

## License

This project is licensed under the **GNU Lesser General Public License v3.0 (LGPL-3.0)**.

This project includes code from:
- **kotlin-vscode** (Apache 2.0) - Copyright JetBrains s.r.o.
- **Kotlin LSP Server** (Apache 2.0) - Copyright JetBrains s.r.o.
- **ADT** (LGPL-3.0) - Copyright yamsergey

See [THIRD-PARTY-NOTICES](vscode-plugin/android-lsp/THIRD-PARTY-NOTICES) for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a pull request.

## Acknowledgments

- [JetBrains](https://www.jetbrains.com/) for the original Kotlin LSP implementation
- [yamsergey](https://github.com/yamsergey/yamsergey.adt) for the ADT project
- [Kotlin LSP Issue #97](https://github.com/Kotlin/kotlin-lsp/issues/97#issuecomment-3957021983) for Compose compiler plugin inspiration

## Links

- [VSCode Extension README](vscode-plugin/android-lsp/README.md)
- [ADT README](core/adt/README.md)
- [Kotlin LSP README](core/kotlin-lsp/README.md)
- [中文文档](README_CN.md)
