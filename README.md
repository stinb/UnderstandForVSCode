# Understand for Visual Studio Code

Install this and run Userver to make VSCode communicate with an Understand database.

## Setup for Building

Install `npm` on Windows
```
winget install Node.js
echo Add "C:\Program Files\nodejs" to your path and start a new terminal
```

Install `npm` on Ubuntu/Debian
```
apt install nodejs
```

Install `vsce`
```
npm install -g @vscode/vsce
```

## Building

### Build the release version
```
make
```

### Continuously build the debug version when source files change
```
make watch
```

## Installation

### Install in CLI

```
code --install-extension understand-1.0.0.vsix
```

### Install in GUI

1. Open VS Code
2. Extensions > (3 Dot Menu) > Install from VSIX...

### [Installation Guide](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix)
