# Understand for Visual Studio Code

Understand by [SciTools](https://www.scitools.com) is a popular platform for code comprehension and maintaining legacy code. This plugin shows the static analysis results from Understand in Visual Studio Code.


## Features

![Screenshot of an analysis error violation in the editor](res/screenshotErrorInEditor.png)

* See violations in the editor
	* Errors from compiling and analyzing
	* Warnings from your selected [CodeCheck](https://support.scitools.com/support/solutions/articles/70000583282-codecheck-overview) groups (CodeCheck configurations)

* Here are 2 ways to analyze files
	* Automatically analyze files on save... or
	* Manually analyze files with a [command](https://code.visualstudio.com/api/extension-guides/command)

* [Supported languages](https://support.scitools.com/support/solutions/articles/70000582794-supported-languages)
	* Ada
	* Assembly
	* C/C++
	* C#
	* FORTRAN
	* Java
	* JOVIAL
	* Delphi/Pascal
	* Python
	* VHDL
	* Visual Basic (.NET)
	* Web Languages


## Setup

![Screenshot of the status item showing "Connected to the Understand language server"](res/screenshotConnected.png)

1. [Install Understand](https://licensing.scitools.com/download), which comes with UServer, the language server

2. Make UServer accessible to Visual Studio Code
	* Windows: The folder of its installation should be added to the PATH environment variable.
	* Other: Run `sudo ln -s /your/path/to/userver /usr/bin` to make a link to the executable (because PATH is ignored by Node.js).

3. Using at least 1 source code file, [create a project in Understand](https://support.scitools.com/support/solutions/articles/70000582579-building-an-accurate-understand-project), resulting in a .und folder

4. If you want to see violations from CodeCheck, [make your CodeCheck configuration(s) run in the background](https://support.scitools.com/support/solutions/articles/70000641317-background-static-analysis-codechecks)

5. Open Visual Studio Code and install this extension

6. In Visual Studio Code, open a folder/[workspace](https://code.visualstudio.com/docs/editor/workspaces) with those source code files
* What happens next, automatically
	* If the file is a supported language, then the Understand language server is started
	* If there's a .und folder somewhere in the file [explorer](https://code.visualstudio.com/docs/getstarted/userinterface#_explorer), it will be selected automatically by the language server
	* On the bottom status bar on the left, hover and see that it's connected


## FAQ

> Why is the language server executable not found?

Read step 2 "Make UServer accessible to Visual Studio Code" above in setup

> Why aren't my results accurate after creating or deleting a file?

If your project uses [compile_commands.json](https://support.scitools.com/support/solutions/articles/70000582648-building-projects-with-json), then you must build after creating or deleting files.

> How do I see the name of a violation?

Do any of the following

* Hover over the problem (this also shows the detailed description)
* In settings, enable "Problems: Show Current in Status" and place the text cursor on the problem
* Run a command that starts with "Understand: Violations: Go to"
* Place the text cursor on the problem, and run the command "Show or Focus Hover"
```jsonc
// Example keybindings: Commands that start with "Understand: Violations: Go to"
{
	"key": "f8",
	"command": "understand.violations.goToNextViolationInCurrentFile",
	"when": "editorTextFocus",
},
{
	"key": "shift+f8",
	"command": "understand.violations.goToPreviousViolationInCurrentFile",
	"when": "editorTextFocus",
},
// Example keybinding: "Show or Focus Hover" command (this also shows the detailed description)
{
	"key": "shift+space",
	"command": "editor.action.showHover",
	"when": "editorTextFocus",
},
```

> How do I skip certain violations with the "Go to Next/Previous Violation" commands?

* There are 4 levels of severity for violations in the language server protocol: error, warning, info, and hint.
* For violations from another extension (like a spell checker), go into the settings of that extension and change the severity to a hint. This limitation is an [issue](https://github.com/microsoft/vscode/issues/105795) on the backlog of the Visual Studio Code team.
* For violations from Understand, enable/disable different warnings in the [CodeCheck configuration in Understand](https://support.scitools.com/support/solutions/articles/70000641317-background-static-analysis-codechecks).

> How do I have more control over showing/focusing on the violations (Problems panel)?

In [keybindings.json](https://code.visualstudio.com/docs/getstarted/keybindings#_advanced-customization), try different keybindings like the following. Read more about the ["when" property](https://code.visualstudio.com/api/references/when-clause-contexts) and [running multiple commands](https://code.visualstudio.com/docs/getstarted/keybindings#_running-multiple-commands).
```jsonc
// Example keybinding: Show violations and focus on violations, but close when it's focused
{
	"key": "alt+v",
	"command": "understand.violations.toggleVisibilityAndFocus",
},
// Example keybinding: When in the editor, show violations but keep focus on the editor
{
	"key": "alt+v",
	"command": "runCommands",
	"when": "editorFocus && activePanel != 'workbench.panel.markers'",
	"args": {
		"commands": [
			"understand.violations.toggleVisibilityAndFocus",
			"workbench.action.focusLastEditorGroup",
		],
	}
},
// Example keybinding: When in the editor, close violations from the editor
{
	"key": "alt+v",
	"command": "runCommands",
	"when": "editorFocus && activePanel == 'workbench.panel.markers'",
	"args": {
		"commands": [
			"understand.violations.toggleVisibilityAndFocus",
			"understand.violations.toggleVisibilityAndFocus",
			"workbench.action.focusLastEditorGroup",
		],
	}
},
// Example keybinding: When in the violations panel, focus on the editor
{
	"key": "alt+v",
	"when": "panelFocus && activePanel == 'workbench.panel.markers'",
	"command": "workbench.action.focusLastEditorGroup",
},
// Example keybinding: When in the violations panel, close it
{
	"key": "escape",
	"when": "panelFocus && activePanel == 'workbench.panel.markers'",
	"command": "understand.violations.toggleVisibilityAndFocus",
},
```
