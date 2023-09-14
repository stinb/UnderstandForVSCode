# Commands
release: node_modules
	rm -f *.vsix
	vsce package
watch: node_modules
	npm run esbuild-watch

# Targets
node_modules:
	npm install
