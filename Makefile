all: node_modules
	npm run vscode:prepublish

watch: node_modules
	npm run esbuild-watch

node_modules:
	npm install

clean:
	rm *.vsix
