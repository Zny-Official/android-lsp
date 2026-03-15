# Android LSP

A VSCode extension providing language support for Android/Kotlin projects, integrating JetBrains Kotlin LSP and ADT (Android Development Tools).

## Features

- ✅ **Automatic Android Project Detection** - Detects Gradle configuration and AndroidManifest.xml
- ✅ **Automatic workspace.json Generation** - Uses ADT CLI to parse Android project dependencies
- ✅ **Code Completion** - Intelligent Kotlin/Android code completion
- ✅ **Code Navigation** - Go to definition, find references
- ✅ **Code Refactoring** - Rename, extract method, etc.
- ✅ **Debug Support** - Kotlin/Android program debugging
- ✅ **Out of the Box** - Bundled Kotlin LSP Server and JRE

## Directory Structure

```
android-lsp/
├── src/                    # TypeScript source code
│   ├── extension.ts        # Extension entry point
│   ├── lspClient.ts        # LSP client
│   ├── projectDetector.ts  # Android project detection
│   ├── adtManager.ts       # ADT CLI management
│   └── workspaceGenerator.ts # workspace.json generation
├── server/                 # Kotlin LSP Server (generated during packaging)
├── adt-cli/                # ADT CLI tool (copied during packaging)
├── dist/                   # Compiled output
├── syntaxes/               # Kotlin syntax highlighting
└── icons/                  # Icon resources
```

## Build Instructions

### Requirements

- Node.js 22.x or higher
- npm 10.x or higher
- Java 21+ (for ADT CLI)

### Install Dependencies

```bash
cd vscode-plugin/android-lsp
npm install
```

### Development Build

```bash
npm run compile
```

### Production Build

```bash
npm run package
```

### Package VSIX

Before packaging, you need to prepare the following:

#### 1. Prepare Kotlin LSP Server

Download or specify the Kotlin LSP Server zip file path:

```bash
export LSP_ZIP_PATH="/path/to/kotlin-lsp-xxx.zip"
```

#### 2. Prepare ADT CLI

Build and copy ADT CLI from the ADT project:

```bash
# Build ADT CLI
cd /path/to/adt/project
./gradlew :adt-cli:installDist

# Copy to extension directory
cp -r adt-cli/build/install/adt-cli /path/to/android-lsp/vscode-plugin/android-lsp/

# Add execute permission
chmod +x /path/to/android-lsp/vscode-plugin/android-lsp/adt-cli/bin/adt-cli
```

#### 3. Execute Packaging

```bash
# Set LSP Server path
export LSP_ZIP_PATH="/path/to/kotlin-lsp-xxx.zip"

# Package
npx @vscode/vsce package 1.0.0 --out android-lsp-1.0.0.vsix
```

Or use the packaging script:

```bash
./package.sh 1.0.0
```

## How It Works

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Android LSP Extension Startup                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Project Detection (projectDetector.ts)                      │
│     - Check build.gradle / settings.gradle                      │
│     - Check AndroidManifest.xml                                 │
│     - Determine if Android project                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
            ┌───────────────┐   ┌───────────────┐
            │ Android Project│   │Pure Kotlin Proj│
            └───────────────┘   └───────────────┘
                    │                   │
                    ▼                   │
┌─────────────────────────────────────┐│
│  2. Generate workspace.json (ADT CLI)││
│     - Parse Gradle dependencies     ││
│     - Generate module information   ││
│     - Save to project root          ││
└─────────────────────────────────────┘│
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Start Kotlin LSP Server                                      │
│     - Use bundled kotlin-lsp.sh                                  │
│     - Read workspace.json (Android projects)                     │
│     - Provide LSP services                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. LSP Features                                                 │
│     - Code completion                                            │
│     - Code navigation                                            │
│     - Code refactoring                                           │
│     - Error diagnostics                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | File | Function |
|-----------|------|----------|
| Project Detection | `projectDetector.ts` | Detect project type (Android/Kotlin) |
| ADT Management | `adtManager.ts` | Call ADT CLI to generate workspace.json |
| Workspace Generation | `workspaceGenerator.ts` | Manage workspace.json generation |
| LSP Client | `lspClient.ts` | Start and manage Kotlin LSP Server |
| Status Bar | `statusBar.ts` | Display LSP status and project type |

## Post-Installation Configuration

### Automatic Configuration (No User Action Required)

The following features work out of the box:

- ✅ Kotlin LSP Server (bundled)
- ✅ JRE runtime (bundled)
- ✅ Kotlin syntax highlighting
- ✅ Automatic project detection

### User Configuration Required

#### 1. ADT CLI Permissions (macOS/Linux)

After first installation, grant execute permission to ADT CLI:

```bash
chmod +x ~/.vscode/extensions/android-lsp.android-lsp-*/adt-cli/bin/adt-cli
```

#### 2. Java 21+ Environment

ADT CLI requires Java 21 or higher:

```bash
# Check Java version
java -version

# If not installed, install Java 21+
# macOS:
brew install openjdk@21
```

#### 3. Optional Settings

Configure in VSCode settings:

```json
{
  // ADT CLI path (default: bundled version)
  "androidLSP.adtCliPath": null,
  
  // JDK path (for symbol resolution)
  "androidLSP.jdkForSymbolResolution": null,
  
  // Additional JVM arguments
  "androidLSP.additionalJvmArgs": []
}
```

## Commands

| Command | Description |
|---------|-------------|
| `Android LSP: Generate workspace.json` | Manually generate workspace.json |
| `Android LSP: Restart LSP` | Restart LSP Server |
| `Android LSP: Sync Gradle` | Sync Gradle and regenerate workspace.json |

## Troubleshooting

### LSP Startup Failure

1. Check Kotlin LSP Server permissions:
```bash
chmod +x ~/.vscode/extensions/android-lsp.android-lsp-*/server/kotlin-lsp.sh
```

2. Remove macOS quarantine attribute:
```bash
xattr -cr ~/.vscode/extensions/android-lsp.android-lsp-*/
```

### workspace.json Generation Failure

1. Confirm Java 21+ is installed:
```bash
java -version
```

2. Confirm ADT CLI has execute permission:
```bash
chmod +x ~/.vscode/extensions/android-lsp.android-lsp-*/adt-cli/bin/adt-cli
```

3. Test ADT CLI manually:
```bash
~/.vscode/extensions/android-lsp.android-lsp-*/adt-cli/bin/adt-cli workspace /path/to/android/project
```

### Project Not Recognized as Android Project

Ensure the project contains one of the following:
- `build.gradle` or `build.gradle.kts` (with `com.android.application` plugin)
- `app/src/main/AndroidManifest.xml`

## License

This project is licensed under the GNU Lesser General Public License v3.0 (LGPL-3.0).

This project includes the following third-party components:

| Component | License | Copyright |
|-----------|---------|-----------|
| kotlin-vscode | Apache 2.0 | JetBrains s.r.o. |
| Kotlin LSP Server | Apache 2.0 | JetBrains s.r.o. |
| ADT | LGPL-3.0 | yamsergey |

See [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES) for details.

### Source Code Availability

Source code for third-party libraries used in this project:

- kotlin-vscode: https://github.com/JetBrains/kotlin-vscode
- Kotlin LSP Server: https://github.com/JetBrains/kotlin-lsp
- ADT: https://github.com/yamsergey/adt

### Replacing ADT CLI Version

To use a different version of ADT CLI:

1. Download from: https://github.com/yamsergey/adt/releases
2. Replace the `adt-cli/` directory
3. Restart VSCode
