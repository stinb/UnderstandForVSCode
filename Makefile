# Variables
WATCH  := $(wildcard src/*.ts) $(wildcard src/commands/*.ts) $(wildcard src/other/*.ts) package.json $(wildcard res/*) $(wildcard *.md) Makefile
OUTPUT := understand.vsix

# Targets
$(OUTPUT): node_modules $(WATCH)
	node node_modules/typescript/bin/tsc && node_modules/@vscode/vsce/vsce package -o $(OUTPUT) --baseImagesUrl https://raw.githubusercontent.com/stinb/UserverVscode/main/
node_modules:
	npm install

# Commands
clean:
	git clean -dfX
watch: node_modules
	npm run esbuild-watch
install: $(OUTPUT)
	code --install-extension $(OUTPUT)
run: $(OUTPUT)
	code --install-extension $(OUTPUT) && code
