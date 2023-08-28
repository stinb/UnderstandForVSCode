# Commands
release: node_modules
	npm run vscode:prepublish
watch: node_modules
	npm run esbuild-watch
clean:
	rm *.vsix

# Targets
node_modules:
	npm install

