# Variables
WATCH  := $(wildcard src/*.ts) package.json $(wildcard logo/*) $(wildcard *.md) Makefile
OUTPUT := understand.vsix

# Targets
$(OUTPUT): node_modules $(WATCH)
	vsce package -o $(OUTPUT)
node_modules:
	npm install

# Commands
watch: node_modules
	npm run esbuild-watch
install: $(OUTPUT)
	code --install-extension $(OUTPUT)
