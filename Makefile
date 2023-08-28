# Commands
release: node_modules
	vsce package
watch: node_modules
	npm run esbuild-watch
clean:
	rm *.vsix

# Targets
node_modules:
	npm install

