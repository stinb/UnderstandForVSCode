all: node_modules
	vsce package

node_modules:
	npm install

clean:
	rm *.vsix
