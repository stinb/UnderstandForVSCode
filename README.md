# Understand for Visual Studio Code

Understand by [SciTools](https://www.scitools.com) is a popular platform for code comprehension and maintaining legacy code. This plugin shows the static analysis results from Understand in Visual Studio Code.


## Features

__Understand Different Languages__
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
* [Details of supported languages](https://support.scitools.com/support/solutions/articles/70000582794-supported-languages)

---
__See or Go To References__

![Screenshot of hover information with types in the editor](res/screenshotReferences.png)

* Kinds of references
	* Definition
	* Declaration
	* Type Definition
	* Implementations
	* All References
* Where to see references
	* [Peek](https://code.visualstudio.com/docs/editor/editingevolved#_peek) at references in with a code popup
	* Instantly [go to](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) a reference
	* Find all references in the [side bar](https://code.visualstudio.com/docs/getstarted/userinterface) with the ability to dismiss them

---
__See Hover Information__

![Screenshot of hover information with types in the editor](res/screenshotHover.png)

* Types of objects, functions, parameters, classes, type aliases, etc.
* Values of objects, macros, etc.

---
__See Errors and Warnings__

![Screenshot of an analysis error violation in the editor](res/screenshotErrorInEditor.png)

* Kinds of violations
	* Errors and warnings from preprocessing and compiling
	* Warnings from your selected [CodeChecks](https://support.scitools.com/support/solutions/articles/70000583282-codecheck-overview)
* Ignore any violations or quick fix some with [code actions](https://code.visualstudio.com/docs/editor/refactoring#_code-actions-quick-fixes-and-refactorings)
* Detailed descriptions of CodeCheck violations
* Violations available in the editor, file explorer [side bar](https://code.visualstudio.com/docs/getstarted/userinterface), and problems [panel](https://code.visualstudio.com/docs/getstarted/userinterface)

---
__Quickly Analyze Your Code__

![Screenshot of analysis progress on the status bar](res/screenshotAnalysis.png)

* Automatically analyze files on save... or
* Manually analyze files with a [command](https://code.visualstudio.com/api/extension-guides/command)

---
__Explore in _Understand___

![Screenshot of our main product Understand](res/screenshotUnderstand.png)

* If the current file in the database, explore it in _Understand_ for the full experience
	* Discover how legacy code fits together
	* Visualize with customizable Graphs
	* Comply with any standard including AUTOSAR/MISRA
	* Detect and fix issues early
	* Solve problems and automate solutions with full API access
	* Gain insight with actionable metrics
	* More at [scitools.com](https://scitools.com) and [blog.scitools.com](https://blog.scitools.com)

## Setup

![Screenshot of the status item showing "Connected to the Understand language server"](res/screenshotConnected.png)

## Setup: Installation

1. [Install _Understand_](https://licensing.scitools.com/download), which comes with _UServer_, the _Understand_ language server

2. Make the command `userver` accessible to Visual Studio Code
	* Windows: The folder of its installation should be added to the PATH environment variable.
	* Other: Run `sudo ln -s /your/path/to/userver /usr/bin` to make a link to the executable (because PATH is ignored by Node.js).

3. Open Visual Studio Code and install this extension, if you haven't already

## Setup: Project Creation

1. Using at least 1 source code file, [create a project in _Understand_](https://support.scitools.com/support/solutions/articles/70000582579-building-an-accurate-understand-project), resulting in a .und folder

2. If you want to see violations from CodeCheck, [make your CodeCheck configuration(s) run in the background](https://support.scitools.com/support/solutions/articles/70000641317-background-static-analysis-codechecks)

3. In Visual Studio Code, open a folder/[workspace](https://code.visualstudio.com/docs/editor/workspaces) with those source code files

* What happens next, automatically
	* If the file is a supported language, then the _Understand_ language server will start.
	* On the bottom status bar on the left, hover and see that it's connected.
	* If there's a _.und_ folder somewhere in the [file explorer](https://code.visualstudio.com/docs/getstarted/userinterface#_explorer), it will be selected automatically by the language server.

## FAQ

> Why is the language server executable not found?

Read step 2 "Make the command `userver` accessible to Visual Studio Code" above in setup

---
> Why aren't my results accurate after creating or deleting a file?

If your project uses [compile_commands.json](https://support.scitools.com/support/solutions/articles/70000582648-building-projects-with-json), then you must build after creating or deleting files.

---
> Now that I am connected to the _Understand_ language server, how do I use it?

Command Palette:
1. Open the [command palette](https://code.visualstudio.com/api/ux-guidelines/command-palette) and type in _Understand_ to see all of the commands available to you.
2. Click the gear to view the command ID and [start adding keyboard startcuts](https://code.visualstudio.com/docs/getstarted/keybindings).

Status Bar:
* On the bottom status bar on the left, hover over _Understand_ to see buttons for common commands.

---
> How do I see the name of a violation?

Do any of the following

* Hover over the squiggle (this also shows the detailed description)
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

---
> How do I skip certain violations with the "Go to Next/Previous Violation" commands?

* There are 4 levels of severity for violations in the language server protocol: error, warning, info, and hint.
* For violations from another extension (like a spell checker), go into the settings of that extension and change the severity to a hint. This limitation is an [issue](https://github.com/microsoft/vscode/issues/105795) on the backlog of the Visual Studio Code team.
* For violations from Understand, enable/disable different warnings in the [CodeCheck configuration in Understand](https://support.scitools.com/support/solutions/articles/70000641317-background-static-analysis-codechecks).

---
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
