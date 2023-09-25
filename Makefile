# Variables
SOURCE := $(wildcard src/*.ts)
OUTPUT := understand.vsix

# Targets
$(OUTPUT): node_modules $(SOURCE)
	vsce package -o $(OUTPUT)
node_modules:
	npm install

# Commands
watch: node_modules
	npm run esbuild-watch
install: $(OUTPUT)
	code --install-extension $(OUTPUT)
