# Understand for Visual Studio Code

_Understand_ by [SciTools](https://www.scitools.com) is a popular platform for code comprehension and maintaining legacy code. This plugin shows the static analysis results from Understand in Visual Studio Code.


---
## Video

See the extension in action in [our video](https://youtu.be/4Unt2SXtkrE).

[![Video: Get the best of both worlds with the Visual Studio Code extension for Understand](https://raw.githubusercontent.com/stinb/UserverVscode/main/res/videoThumbnail.png)](https://youtu.be/4Unt2SXtkrE)

---
## Licensing

To use this extension, you must have a valid _Understand_ license. Try it for free with a trial license. Students and teachers can get a free educational license. Please see available options at [scitools.com/pricing](https://scitools.com/pricing).


---
## Compare to Other Extensions

|                                     |Understand by SciTools|C/C++ by Microsoft|clangd by LLVM|C/C++ Advanced Lint by Joseph Benden|
|-------------------------------------|----------------------|------------------|--------------|------------------------------------|
|__Supports more than C/C++__         |✔️                    |❌                |❌            |❌                                  |
|__Can analyze whole project__        |✔️                    |✔️                |❌            |❌                                  |
|__See all errors/warnings at launch__|✔️                    |❌                |❌            |❌                                  |
|__Definitions and other references__ |✔️                    |✔️                |✔️            |❌                                  |
|__Hover for arguments, type, etc.__  |✔️                    |✔️                |✔️            |❌                                  |
|__AUTOSAR, MISRA, CERT, etc.__       |✔️                    |❌                |❌            |✔️                                  |
|__Companion GUI application__        |✔️                    |❌                |❌            |❌                                  |

* Note: this comparison may not be perfect. It is just an observation of whether or not these features were found in each extension.


---
## Compatibility

- Windows 10 and newer
- MacOS 14 and newer
- Linux


---
## Features

__See or Go To References__

![Screenshot of hover information with types in the editor](https://raw.githubusercontent.com/stinb/UserverVscode/main/res/screenshotReferences.png)

* Kinds of references
	* Definition
	* Declaration
	* Type Definition
	* Implementations
	* All References
* Where to see references
	* [Peek](https://code.visualstudio.com/docs/editor/editingevolved#_peek) at references with a code popup
	* Instantly [go to](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) a reference
	* Find all references in the [side bar](https://code.visualstudio.com/docs/getstarted/userinterface) with the ability to dismiss them

---
__See Hover Information__

![Screenshot of hover information with types in the editor](https://raw.githubusercontent.com/stinb/UserverVscode/main/res/screenshotHover.png)

* Types of objects, functions, parameters, classes, type aliases, etc.
* Values of objects, macros, etc.

---
__See Errors and Warnings__

![Screenshot of an analysis error violation in the editor](https://raw.githubusercontent.com/stinb/UserverVscode/main/res/screenshotErrorInEditor.png)

* Kinds of violations
	* Errors and warnings from preprocessing and compiling
	* Warnings from your selected [CodeChecks](https://support.scitools.com/support/solutions/articles/70000583282-codecheck-overview)
* Ignore CodeCheck violations or quick fix some with [code actions](https://code.visualstudio.com/docs/editor/refactoring#_code-actions-quick-fixes-and-refactorings)
* Detailed descriptions of CodeCheck violations
* Violations available in the editor, file explorer [side bar](https://code.visualstudio.com/docs/getstarted/userinterface), and problems [panel](https://code.visualstudio.com/docs/getstarted/userinterface)

---
__Quickly Analyze Your Code__

![Screenshot of analysis progress on the status bar](https://raw.githubusercontent.com/stinb/UserverVscode/main/res/screenshotAnalysis.png)

* Automatically analyze files on save... or
* Manually analyze files with a [command](https://code.visualstudio.com/api/extension-guides/command)

---
__Explore in _Understand___

![Screenshot of our main product Understand](https://raw.githubusercontent.com/stinb/UserverVscode/main/res/screenshotUnderstand.png)

* If the current file is in the database, explore it in _Understand_ for the full experience
	* Discover how legacy code fits together
	* Visualize with customizable graphs
	* Comply with any standard including AUTOSAR/MISRA
	* Detect and fix issues early
	* Solve problems and automate solutions with full API access
	* Gain insight with actionable metrics
	* More at [scitools.com](https://scitools.com) and [blog.scitools.com](https://blog.scitools.com)

---

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
## Setup

![Screenshot of the status item showing "Connected to the Understand language server"](https://raw.githubusercontent.com/stinb/UserverVscode/main/res/screenshotConnected.png)

## Setup: Installation

1. [Install _Understand_](https://licensing.scitools.com/download), which comes with _UServer_, the _Understand_ language server

2. Open Visual Studio Code and [install this extension](https://github.com/stinb/UnderstandForVSCode/wiki/Installing-the-Extension), if you haven't already

## Setup: Project Creation

1. Using at least 1 source code file, [create a project in _Understand_](https://support.scitools.com/support/solutions/articles/70000582579-building-an-accurate-understand-project), resulting in a .und folder. With this extension, you can simply create a source code file and run the command "Understand: Explore in Understand: New Project" to quickly get started.

2. If you want to see violations from CodeCheck, [make your CodeCheck configuration(s) run in the background](https://support.scitools.com/support/solutions/articles/70000641317-background-static-analysis-codechecks)

3. In Visual Studio Code, open a folder/[workspace](https://code.visualstudio.com/docs/editor/workspaces) that contains the _.und_ folder. Also, include all of the source code files that you want.

* What happens next, automatically
	* If there's one _.und_ folder somewhere in the [file explorer](https://code.visualstudio.com/docs/getstarted/userinterface#_explorer), the extension starts.
	* On the bottom status bar on the left, hover on the _Understand_ section and see that the extension has connected to `userver`.


---
## FAQ

> Why is the language server executable not found?

Make the command `userver` accessible to Visual Studio Code
	* Option 1: Change the setting `understand.server.executable` to your userver path like `/your/path/to/userver`
	* Option 2: Add the path to `userver` to the `PATH` environment variable
		* Windows: Add "C:\Program Files\SciTools\bin\pc-win64" to the system PATH. This is usually handled automatically by the Understand installer.
		* Linux & Mac: In your `~/.profile` file, add `export PATH="/your/path/to:$PATH"` where `/your/path/to` is the parent directory of `userver`
	* Option 3: On Linux or Mac, add a symbolic link
		* Linux: `sudo ln -s /your/path/to/userver /usr/bin`
		* Mac: `sudo mkdir -p /usr/local/bin && sudo ln -s /your/path/to/userver /usr/local/bin`

> Why isn't the language server starting?

Make sure that you have a _.und_ folder in your file explorer, which is created automatically when creating an _Understand_ project.

---
> Why aren't my results accurate after creating or deleting a file?

If your project uses [compile_commands.json](https://support.scitools.com/support/solutions/articles/70000582648-building-projects-with-json), then you must build after creating or deleting files.

---
> Now that I am connected to the _Understand_ language server, how do I use it?

Command Palette:
1. Open the command palette with [the keybinding for `workbench.action.showCommands`](https://code.visualstudio.com/docs/getstarted/keybindings#_navigation) and type in _Understand_ to see all of the commands available to you.
2. Click the gear to view the command ID and [start adding keyboard startcuts](https://code.visualstudio.com/docs/getstarted/keybindings).

Status Bar:
* On the bottom status bar on the left, hover over _Understand_ to see buttons for common commands.

Code Actions:
* In a resolved file, the lightbulb icon will appear with some [code actions](https://code.visualstudio.com/docs/editor/editingevolved#_code-action).

Editor Context Menu:
* In a resolved file, right click code to see the editor context menu and see references like [go to definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition).

---
> Why don't I see some commands in certain files?

If a file isn't a resolved project file, then the file-specific commands won't show up in the command palette. The other commands - general and project-specific - should still be available.

---
> Why don't I see certain kinds of references, like declarations, type definitions, or implementations?
* It might be because the token doesn't have an entity, like a number literal or a keyword.
* An entity may not have the reference kind that you are looking for. For example, in C, an `int` object doesn't have a type definition because it's a primitive type, but a `struct` object does if the type is resolved.
* Some languages don't have certain reference kinds. For example, C doesn't have implementations, but Java does.

---
> Why don't violations go away after manually fixing them?
* You should analyze after manually fixing an error or warning.

---
> How do I see the name of a violation?

Do any of the following

* Hover over the squiggle (this also shows the detailed description)
* In [settings](https://code.visualstudio.com/docs/getstarted/userinterface#_settings), enable "Problems: Show Current in Status" and place the text cursor on the problem
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
* For violations from another extension (like a spell checker), go into the settings of that extension and change the severity to a hint. This limitation is [an issue on the backlog of the Visual Studio Code team]((https://github.com/microsoft/vscode/issues/105795)).
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

---
> How do I change the colors of violations?

In [settings.json](https://code.visualstudio.com/docs/getstarted/settings#_settingsjson), the colors can be changed. This is especially useful for color blind users
```jsonc
{
	// See all color customizations:
	// https://code.visualstudio.com/api/references/theme-color
	"workbench.colorCustomizations": {
		// Editor squiggles and problems panel
		"editorWarning.foreground": "#ffff77",
		"editorError.foreground": "#ff7777",
		// File name color
 		"list.warningForeground": "#ffff77",
		"list.errorForeground": "#ff7777"
	}
}
```
