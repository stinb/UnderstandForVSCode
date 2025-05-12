# Variables
WATCH := $(wildcard src/*.ts) $(wildcard src/commands/*.ts) $(wildcard src/other/*.ts) $(wildcard src/viewProviders/*.ts) package.json $(wildcard res/*) $(wildcard res/views/*) $(wildcard *.md) Makefile
OUTPUT := understand.vsix
ESBUILD := node node_modules/esbuild/bin/esbuild ./src/main.ts --bundle --outfile=extension.js --external:vscode --format=cjs --platform=node --minify

# Targets
$(OUTPUT): $(WATCH)
	@echo --------------------------------------------------------------------------------
	npm install
	@echo --------------------------------------------------------------------------------
	node node_modules/typescript/bin/tsc
	@echo --------------------------------------------------------------------------------
	node node_modules/@vscode/vsce/vsce package -o $(OUTPUT)

# Commands
clean:
	git clean -dfX
debug:
	$(ESBUILD)
	code --extensionDevelopmentPath="$(CURDIR)"
install: $(OUTPUT)
	code --install-extension $(OUTPUT)
run: $(OUTPUT)
	code --install-extension $(OUTPUT)
	code
watch: node_modules
	$(ESBUILD) --watch
