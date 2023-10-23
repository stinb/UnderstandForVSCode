# Variables
WATCH  := $(wildcard src/*.ts) package.json $(wildcard res/*) $(wildcard *.md) Makefile
OUTPUT := understand.vsix

CHECK := node node_modules/typescript/bin/tsc

# Targets
$(OUTPUT): node_modules $(WATCH)
	$(CHECK) && vsce package -o $(OUTPUT)
node_modules:
	npm install

# Commands
watch: node_modules
	npm run esbuild-watch
install: $(OUTPUT)
	code --install-extension $(OUTPUT)
run: $(OUTPUT)
	code --install-extension $(OUTPUT) && code
