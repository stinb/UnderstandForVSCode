# Variables
WATCH  := $(wildcard src/*.ts) package.json $(wildcard res/*) $(wildcard *.md) Makefile
OUTPUT := understand.vsix

# Targets
$(OUTPUT): node_modules $(WATCH)
	vsce package -o $(OUTPUT) --baseContentUrl https://raw.githubusercontent.com/stinb/UserverVscode/main/res/
node_modules:
	npm install

# Commands
watch: node_modules
	npm run esbuild-watch
install: $(OUTPUT)
	code --install-extension $(OUTPUT)
