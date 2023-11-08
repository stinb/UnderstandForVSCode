# Variables
WATCH  := $(wildcard src/*.ts) package.json $(wildcard res/*) $(wildcard *.md) Makefile
OUTPUT := understand.vsix

# Targets
$(OUTPUT): node_modules $(WATCH)
	node_modules/typescript/bin/tsc && node_modules/@vscode/vsce/vsce package -o $(OUTPUT)
node_modules:
	npm install

# Commands
watch: node_modules
	npm run esbuild-watch
install: $(OUTPUT)
	code --install-extension $(OUTPUT)
run: $(OUTPUT)
	code --install-extension $(OUTPUT) && code
