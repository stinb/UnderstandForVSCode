# Variables
TS_IN := $(wildcard src/*.ts) $(wildcard src/commands/*.ts) $(wildcard src/other/*.ts) $(wildcard src/viewProviders/*.ts)
TS_OUT := extension.js
ESBUILD := node node_modules/esbuild/bin/esbuild ./src/main.ts --bundle --outfile=$(TS_OUT) --external:vscode --format=cjs --platform=node --minify
VSIX_IN := $(TS_IN) package.json $(wildcard res/*) $(wildcard res/views/*) $(wildcard *.md) Makefile
VSIX_OUT := understand.vsix

# Targets
$(VSIX_OUT): $(VSIX_IN)
	@echo --------------------------------------------------------------------------------
	npm install --ignore-scripts
	@echo --------------------------------------------------------------------------------
	node node_modules/typescript/bin/tsc
	@echo --------------------------------------------------------------------------------
	$(ESBUILD)
	@echo --------------------------------------------------------------------------------
	node node_modules/@vscode/vsce/vsce package -o $(VSIX_OUT)
$(TS_OUT): $(TS_IN)
	$(ESBUILD)

# Commands
clean:
	git clean -dfX
debug: $(TS_OUT)
	code --extensionDevelopmentPath="$(CURDIR)"
install: $(VSIX_OUT)
	code --install-extension $(VSIX_OUT)
run: $(VSIX_OUT)
	code --install-extension $(VSIX_OUT)
	code
watch: node_modules
	$(ESBUILD) --watch
