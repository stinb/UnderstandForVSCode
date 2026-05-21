import * as crypto from 'crypto';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';

import { escapeHtml } from '../other/html';
import { restartLsp } from '../other/languageClient';
import { variables } from '../other/variables';


const LOCAL_MODEL_CHOICES = [
	{ id: 'qwen-fast',      filename: 'Qwen3-1.7B-Q4_K_M.gguf',          label: 'Qwen3-1.7B (1.0 GB) — Best balance of quality and speed' },
	{ id: 'qwen-medium',    filename: 'Qwen3-4B-Q4_K_M.gguf',            label: 'Qwen3-4B (2.3 GB) — Better reasoning with modest resource cost' },
	{ id: 'qwen-accurate',  filename: 'Qwen3-8B-Q4_K_M.gguf',            label: 'Qwen3-8B (4.7 GB) — Stronger code understanding for larger projects' },
	{ id: 'granite-medium', filename: 'granite-4.0-micro-Q4_K_M.gguf',   label: 'Granite4-Micro (3B parameters) (2.0 GB) — US-origin option, balanced choice' },
];

const PROVIDERS = [
	'Understand Local',
	'Understand Remote',
	'LM Studio',
	'Ollama',
	'ChatGPT (OpenAI)',
	'Claude',
	'Gemini',
	'Grok (xAI)',
	'Other',
];

let panel: vscode.WebviewPanel | undefined;
let verifyGeneration = 0;


function parseUndAiServer(serverStr: string): { host: string; port: number }
{
	const DEFAULT_PORT = 56767;
	const s = serverStr.trim();
	if (!s) return { host: '', port: DEFAULT_PORT };
	// Strip ws:// / wss:// prefix and any path, then parse host:port by string.
	// Avoid URL() because it drops default ports (ws→80, wss→443), losing an
	// explicitly-specified port that differs from the server default.
	const bare = s.replace(/^wss?:\/\//, '').split('/')[0];
	const colon = bare.lastIndexOf(':');
	if (colon >= 0) {
		const portNum = parseInt(bare.slice(colon + 1));
		if (portNum > 0 && !isNaN(portNum))
			return { host: bare.slice(0, colon), port: portNum };
	}
	return { host: bare, port: DEFAULT_PORT };
}


function networkErrMsg(e: unknown): string
{
	if (!(e instanceof Error)) return 'Connection failed';
	const m = e.message;
	if (m.includes('ENOTFOUND') || m.includes('getaddrinfo')) return 'Host not found';
	if (m.includes('ECONNREFUSED'))                           return 'Connection refused';
	if (m.includes('ETIMEDOUT') || m.includes('TimeoutError') || m.toLowerCase().includes('abort')) return 'Connection timed out';
	return 'Connection failed';
}


function testTcpConnection(host: string, port: number): Promise<string>
{
	return new Promise(resolve => {
		const socket = new net.Socket();
		socket.setTimeout(5000);
		const done = (err: string) => { socket.destroy(); resolve(err); };
		socket.connect(port, host, () => done(''));
		socket.on('error', () => done(`Failed to connect to ${host}:${port} - make sure it's running`));
		socket.on('timeout', () => done(`Failed to connect to ${host}:${port} - make sure it's running`));
	});
}


export function editProviderSettings(context: vscode.ExtensionContext)
{
	if (panel) {
		panel.reveal();
		return;
	}

	panel = vscode.window.createWebviewPanel(
		'understandAiProviderSettings',
		'Edit Understand AI Provider',
		vscode.ViewColumn.Active,
		{ retainContextWhenHidden: true },
	);

	panel.onDidDispose(() => { panel = undefined; });

	const webview = panel.webview;
	webview.options = { enableScripts: true };

	const cfg = vscode.workspace.getConfiguration();

	// Derive installed models directory from the server executable path.
	// Windows/Linux: <install>/bin/<platform>/exe → up 3 → <install>/conf/understand/models
	// Mac:           Understand.app/Contents/MacOS/exe → up 2 → Contents/Resources/conf/understand/models
	const serverExe = cfg.get<string>('understand.server.executable', '');
	const installedModelsDir = serverExe
		? (process.platform === 'darwin'
			? path.join(path.dirname(path.dirname(serverExe)), 'Resources', 'conf', 'understand', 'models')
			: path.join(path.dirname(path.dirname(path.dirname(serverExe))), 'conf', 'understand', 'models'))
		: '';

	const gs = context.globalState;

	// Find which preset model is currently active (by saved path or model ID)
	const savedModelPath = gs.get<string>('understand.AI.localModelPath') ?? '';
	const savedBasename  = savedModelPath.replace(/\\/g, '/').split('/').pop() || '';
	const activeModel =
		LOCAL_MODEL_CHOICES.find(m => m.filename === savedBasename) ??
		LOCAL_MODEL_CHOICES.find(m => m.id === savedModelPath) ??
		LOCAL_MODEL_CHOICES[0];

	// Default path for Custom GGUF: the installed file for the active preset model
	let localDefaultCustomPath = '';
	if (installedModelsDir) {
		const candidate = path.join(installedModelsDir, activeModel.filename);
		if (fs.existsSync(candidate))
			localDefaultCustomPath = candidate.replace(/\\/g, '/');
	}

	const settings = {
		provider:                cfg.get<string>('understand.AI.provider',  'Understand Local'),
		localModelPath:          savedModelPath,
		localDefaultCustomPath:  localDefaultCustomPath,
		localContextWindowSize:  gs.get<number>('understand.AI.localContextWindowSize') ?? 32000,
		remoteServer:            gs.get<string>('understand.AI.remoteServer')            ?? '',
		lmStudioServer:          gs.get<string>('understand.AI.lmStudioServer')          ?? '127.0.0.1:1234',
		lmStudioModel:           gs.get<string>('understand.AI.lmStudioModel')           ?? '',
		ollamaServer:            gs.get<string>('understand.AI.ollamaServer')            ?? '127.0.0.1:11434',
		ollamaModel:             gs.get<string>('understand.AI.ollamaModel')             ?? '',
		chatGPTServer:           gs.get<string>('understand.AI.chatGPTServer')           || 'https://api.openai.com',
		chatGPTApiKey:           gs.get<string>('understand.AI.chatGPTApiKey')           ?? '',
		chatGPTModel:            gs.get<string>('understand.AI.chatGPTModel')            ?? '',
		claudeServer:            gs.get<string>('understand.AI.claudeServer')            ?? 'https://api.anthropic.com',
		claudeApiKey:            gs.get<string>('understand.AI.claudeApiKey')            ?? '',
		claudeModel:             gs.get<string>('understand.AI.claudeModel')             ?? '',
		geminiServer:            gs.get<string>('understand.AI.geminiServer')            ?? 'https://generativelanguage.googleapis.com/v1beta/openai',
		geminiApiKey:            gs.get<string>('understand.AI.geminiApiKey')            ?? '',
		geminiModel:             gs.get<string>('understand.AI.geminiModel')             ?? '',
		grokServer:              gs.get<string>('understand.AI.grokServer')              ?? 'https://api.x.ai',
		grokApiKey:              gs.get<string>('understand.AI.grokApiKey')              ?? '',
		grokModel:               gs.get<string>('understand.AI.grokModel')               ?? '',
		otherServer:             gs.get<string>('understand.AI.otherServer')             ?? '',
		otherApiKey:             gs.get<string>('understand.AI.otherApiKey')             ?? '',
		otherModel:              gs.get<string>('understand.AI.otherModel')              ?? '',
		lmStudioData:            gs.get<boolean>('understand.AI.ack.lmStudioData')       ?? false,
		ollamaData:              gs.get<boolean>('understand.AI.ack.ollamaData')         ?? false,
		chatGPTData:             gs.get<boolean>('understand.AI.ack.chatGPTData')        ?? false,
		chatGPTFee:              gs.get<boolean>('understand.AI.ack.chatGPTFee')         ?? false,
		claudeData:              gs.get<boolean>('understand.AI.ack.claudeData')         ?? false,
		claudeFee:               gs.get<boolean>('understand.AI.ack.claudeFee')          ?? false,
		geminiData:              gs.get<boolean>('understand.AI.ack.geminiData')         ?? false,
		geminiFee:               gs.get<boolean>('understand.AI.ack.geminiFee')          ?? false,
		grokData:                gs.get<boolean>('understand.AI.ack.grokData')           ?? false,
		grokFee:                 gs.get<boolean>('understand.AI.ack.grokFee')            ?? false,
		otherData:               gs.get<boolean>('understand.AI.ack.otherData')          ?? false,
		otherFee:                gs.get<boolean>('understand.AI.ack.otherFee')           ?? false,
	};

	webview.onDidReceiveMessage(async (msg) => {
		switch (msg.command) {
			case 'save': {
				const s = msg.settings;
				await cfg.update('understand.AI.provider', s.provider, vscode.ConfigurationTarget.Global);
				await gs.update('understand.AI.localModelPath',         s.localModelPath);
				await gs.update('understand.AI.localContextWindowSize', s.localContextWindowSize);
				await gs.update('understand.AI.remoteServer',           s.remoteServer);
				await gs.update('understand.AI.lmStudioServer',         s.lmStudioServer);
				await gs.update('understand.AI.lmStudioModel',          s.lmStudioModel);
				await gs.update('understand.AI.ollamaServer',           s.ollamaServer);
				await gs.update('understand.AI.ollamaModel',            s.ollamaModel);
				await gs.update('understand.AI.chatGPTServer',          s.chatGPTServer);
				await gs.update('understand.AI.chatGPTApiKey',          s.chatGPTApiKey);
				await gs.update('understand.AI.chatGPTModel',           s.chatGPTModel);
				await gs.update('understand.AI.claudeServer',           s.claudeServer);
				await gs.update('understand.AI.claudeApiKey',           s.claudeApiKey);
				await gs.update('understand.AI.claudeModel',            s.claudeModel);
				await gs.update('understand.AI.geminiServer',           s.geminiServer);
				await gs.update('understand.AI.geminiApiKey',           s.geminiApiKey);
				await gs.update('understand.AI.geminiModel',            s.geminiModel);
				await gs.update('understand.AI.grokServer',             s.grokServer);
				await gs.update('understand.AI.grokApiKey',             s.grokApiKey);
				await gs.update('understand.AI.grokModel',              s.grokModel);
				await gs.update('understand.AI.otherServer',            s.otherServer);
				await gs.update('understand.AI.otherApiKey',            s.otherApiKey);
				await gs.update('understand.AI.otherModel',             s.otherModel);
				await gs.update('understand.AI.ack.lmStudioData',       s.lmStudioData);
				await gs.update('understand.AI.ack.ollamaData',         s.ollamaData);
				await gs.update('understand.AI.ack.chatGPTData',        s.chatGPTData);
				await gs.update('understand.AI.ack.chatGPTFee',         s.chatGPTFee);
				await gs.update('understand.AI.ack.claudeData',         s.claudeData);
				await gs.update('understand.AI.ack.claudeFee',          s.claudeFee);
				await gs.update('understand.AI.ack.geminiData',         s.geminiData);
				await gs.update('understand.AI.ack.geminiFee',          s.geminiFee);
				await gs.update('understand.AI.ack.grokData',           s.grokData);
				await gs.update('understand.AI.ack.grokFee',            s.grokFee);
				await gs.update('understand.AI.ack.otherData',          s.otherData);
				await gs.update('understand.AI.ack.otherFee',           s.otherFee);
				panel?.dispose();
				restartLsp();
				break;
			}
			case 'cancel':
				panel?.dispose();
				break;
			case 'browse': {
				const result = await vscode.window.showOpenDialog({
					canSelectMany: false,
					filters: { 'GGUF Files': ['gguf'] },
					title: 'Select GGUF Model File',
				});
				if (result?.length)
					webview.postMessage({ command: 'browseResult', path: result[0].fsPath });
				break;
			}
			case 'openUrl':
				vscode.env.openExternal(vscode.Uri.parse(msg.url));
				break;
			case 'fetchChatGPTModels': {
				try {
					let server = (msg.server as string).trim();
					const apiKey = (msg.apiKey as string).trim();
					if (!server || !apiKey) { webview.postMessage({ command: 'chatGPTModels', models: [], error: '' }); break; }
					if (!server.startsWith('http://') && !server.startsWith('https://'))
						server = 'https://' + server;
					const resp = await fetch(`${server}/v1/models`, {
						headers: { 'Authorization': `Bearer ${apiKey}` },
						signal: AbortSignal.timeout(5000),
					});
					if (resp.status === 401 || resp.status === 403) {
						webview.postMessage({ command: 'chatGPTModels', models: [], error: 'Authentication required' });
					} else {
						const json = await resp.json() as { data?: { id: string }[] };
						const models = (json.data ?? []).map(m => m.id).sort();
						webview.postMessage({ command: 'chatGPTModels', models, error: '' });
					}
				} catch (e) {
					webview.postMessage({ command: 'chatGPTModels', models: [], error: networkErrMsg(e) });
				}
				break;
			}
			case 'fetchClaudeModels': {
				try {
					let server = (msg.server as string).trim();
					const apiKey = (msg.apiKey as string).trim();
					if (!server || !apiKey) { webview.postMessage({ command: 'claudeModels', models: [], error: '' }); break; }
					if (!server.startsWith('http://') && !server.startsWith('https://'))
						server = 'https://' + server;
					const resp = await fetch(`${server}/v1/models`, {
						headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
						signal: AbortSignal.timeout(5000),
					});
					if (resp.status === 401 || resp.status === 403) {
						webview.postMessage({ command: 'claudeModels', models: [], error: 'Authentication required' });
					} else {
						const json = await resp.json() as { data?: { id: string }[] };
						webview.postMessage({ command: 'claudeModels', models: (json.data ?? []).map(m => m.id).sort(), error: '' });
					}
				} catch (e) {
					webview.postMessage({ command: 'claudeModels', models: [], error: networkErrMsg(e) });
				}
				break;
			}
			case 'fetchGeminiModels': {
				try {
					let server = (msg.server as string).trim();
					const apiKey = (msg.apiKey as string).trim();
					if (!server || !apiKey) { webview.postMessage({ command: 'geminiModels', models: [], error: '' }); break; }
					if (!server.startsWith('http://') && !server.startsWith('https://'))
						server = 'https://' + server;
					const resp = await fetch(`${server}/models`, {
						headers: { 'Authorization': `Bearer ${apiKey}` },
						signal: AbortSignal.timeout(5000),
					});
					if (resp.status === 401 || resp.status === 403) {
						webview.postMessage({ command: 'geminiModels', models: [], error: 'Authentication required' });
					} else {
						const json = await resp.json() as { data?: { id: string }[] };
						webview.postMessage({ command: 'geminiModels', models: (json.data ?? []).map(m => m.id).sort(), error: '' });
					}
				} catch (e) {
					webview.postMessage({ command: 'geminiModels', models: [], error: networkErrMsg(e) });
				}
				break;
			}
			case 'fetchGrokModels': {
				try {
					let server = (msg.server as string).trim();
					const apiKey = (msg.apiKey as string).trim();
					if (!server || !apiKey) { webview.postMessage({ command: 'grokModels', models: [], error: '' }); break; }
					if (!server.startsWith('http://') && !server.startsWith('https://'))
						server = 'https://' + server;
					const resp = await fetch(`${server}/v1/models`, {
						headers: { 'Authorization': `Bearer ${apiKey}` },
						signal: AbortSignal.timeout(5000),
					});
					if (resp.status === 401 || resp.status === 403) {
						webview.postMessage({ command: 'grokModels', models: [], error: 'Authentication required' });
					} else {
						const json = await resp.json() as { data?: { id: string }[] };
						webview.postMessage({ command: 'grokModels', models: (json.data ?? []).map(m => m.id).sort(), error: '' });
					}
				} catch (e) {
					webview.postMessage({ command: 'grokModels', models: [], error: networkErrMsg(e) });
				}
				break;
			}
			case 'fetchOtherModels': {
				try {
					let server = (msg.server as string).trim();
					const apiKey = (msg.apiKey as string).trim();
					if (!server) { webview.postMessage({ command: 'otherModels', models: [], error: '' }); break; }
					if (!server.startsWith('http://') && !server.startsWith('https://'))
						server = 'https://' + server;
					server = server.replace(/\/v1\/?$/, '');
					const headers: Record<string, string> = {};
					if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
					const resp = await fetch(`${server}/v1/models`, { headers, signal: AbortSignal.timeout(5000) });
					if (resp.status === 401 || resp.status === 403) {
						webview.postMessage({ command: 'otherModels', models: [], error: 'Authentication required' });
					} else {
						const json = await resp.json() as { data?: { id: string }[] };
						webview.postMessage({ command: 'otherModels', models: (json.data ?? []).map(m => m.id).sort(), error: '' });
					}
				} catch (e) {
					webview.postMessage({ command: 'otherModels', models: [], error: networkErrMsg(e) });
				}
				break;
			}
			case 'fetchOllamaModels': {
				try {
					let server = (msg.server as string).trim();
					if (!server) { webview.postMessage({ command: 'ollamaModels', models: [], error: '' }); break; }
					if (!server.startsWith('http://') && !server.startsWith('https://'))
						server = 'http://' + server;
					const resp = await fetch(`${server}/api/tags`, { signal: AbortSignal.timeout(5000) });
					if (resp.status === 401 || resp.status === 403) {
						webview.postMessage({ command: 'ollamaModels', models: [], error: 'Authentication required' });
					} else {
						const json = await resp.json() as { models?: { name: string }[] };
						webview.postMessage({ command: 'ollamaModels', models: (json.models ?? []).map(m => m.name), error: '' });
					}
				} catch (e) {
					webview.postMessage({ command: 'ollamaModels', models: [], error: networkErrMsg(e) });
				}
				break;
			}
			case 'fetchLmStudioModels': {
				try {
					let server = (msg.server as string).trim();
					if (!server) { webview.postMessage({ command: 'lmStudioModels', models: [], error: '' }); break; }
					if (!server.startsWith('http://') && !server.startsWith('https://'))
						server = 'http://' + server;
					const resp = await fetch(`${server}/v1/models`, { signal: AbortSignal.timeout(5000) });
					if (resp.status === 401 || resp.status === 403) {
						webview.postMessage({ command: 'lmStudioModels', models: [], error: 'Authentication required' });
					} else {
						const json = await resp.json() as { data?: { id: string }[] };
						webview.postMessage({ command: 'lmStudioModels', models: (json.data ?? []).map(m => m.id), error: '' });
					}
				} catch (e) {
					webview.postMessage({ command: 'lmStudioModels', models: [], error: networkErrMsg(e) });
				}
				break;
			}
			case 'verifyRemote': {
				const gen = ++verifyGeneration;
				const { host, port } = parseUndAiServer(msg.server);
				const error = await testTcpConnection(host, port);
				if (gen === verifyGeneration)
					webview.postMessage({ command: 'verifyResult', error });
				break;
			}
		}
	});

	webview.html = buildHtml(webview, settings);
}


function buildHtml(webview: vscode.Webview, s: ReturnType<typeof vscode.workspace.getConfiguration> extends never ? never : any): string
{
	const nonce = crypto.randomBytes(16).toString('hex');
	const csp   = escapeHtml(webview.cspSource);

	const providerOptions = PROVIDERS.map(p =>
		`<option value="${escapeHtml(p)}"${s.provider === p ? ' selected' : ''}>${escapeHtml(p)}</option>`
	).join('\n\t\t\t');

	const localModelIds = new Set(LOCAL_MODEL_CHOICES.map(m => m.id));
	const localPathBasename = s.localModelPath.replace(/\\/g, '/').split('/').pop() || '';
	const localModelByFilename = LOCAL_MODEL_CHOICES.find(m => m.filename === localPathBasename);
	const localIsModel = !s.localModelPath || localModelIds.has(s.localModelPath) || !!localModelByFilename;
	const localActiveModelId = localIsModel ? (localModelByFilename?.id ?? s.localModelPath ?? 'qwen-fast') || 'qwen-fast' : 'qwen-fast';
	const localCustomPath = localIsModel ? '' : s.localModelPath;
	const localDefaultCustomPath: string = s.localDefaultCustomPath || '';
	const localModelOptions = LOCAL_MODEL_CHOICES.map(m =>
		`<option value="${escapeHtml(m.id)}"${m.id === localActiveModelId ? ' selected' : ''}>${escapeHtml(m.label)}</option>`
	).join('\n\t\t\t');

	const feeText = 'Connecting to this AI service may result in charges billed by the service provider. I acknowledge that I am responsible for any fees incurred. All background AI services will be turned off.';
	const dataText = 'I acknowledge that Understand does not control what external services do with my data.';

	function ackRow(dataId: string, feeRowId: string, feeId: string, hasFee: boolean, feeVisible: boolean) {
		const feeDisplay = feeVisible ? '' : ' style="display:none"';
		return `
  <div class="ack-row">
    <input type="checkbox" id="${dataId}" checked>
    <label for="${dataId}">${escapeHtml(dataText)}</label>
  </div>
  <div id="${feeRowId}" class="ack-row"${feeDisplay}>
    <input type="checkbox" id="${feeId}" checked>
    <label for="${feeId}">${escapeHtml(feeText)}</label>
  </div>`;
	}

	function noFeeAckRow(dataId: string) {
		return `
  <div class="ack-row">
    <input type="checkbox" id="${dataId}" checked>
    <label for="${dataId}">${escapeHtml(dataText)}</label>
  </div>`;
	}

	return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px 20px; max-width: 560px; }
  label { display: block; margin-bottom: 4px; font-weight: 600; }
  .row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .row label { margin: 0; min-width: 130px; font-weight: normal; }
  select, input[type=text], input[type=password], input[type=number] {
    flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555); padding: 4px 6px;
    font-family: inherit; font-size: inherit; outline: none;
  }
  select:focus, input:focus { border-color: var(--vscode-focusBorder); }
  hr { border: none; border-top: 1px solid var(--vscode-widget-border, #555); margin: 12px 0; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; cursor: pointer; font-family: inherit; font-size: inherit; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .section { display: none; }
  .section.visible { display: block; }
  .radio-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .radio-row label { display: inline; margin: 0; font-weight: normal; white-space: nowrap; }
  .radio-row select, .radio-row input[type=text] { flex: 1; min-width: 0; }
  .radio-row button { flex-shrink: 0; }
  .help-link { flex-shrink: 0; color: var(--vscode-textLink-foreground); text-decoration: none; font-weight: bold; padding: 0 2px; }
  .help-link:hover { text-decoration: underline; }
  input:disabled, select:disabled { opacity: 0.4; }
  .ack-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
  .ack-row input[type=checkbox] { margin-top: 2px; flex-shrink: 0; }
  .ack-row label { display: inline; margin-bottom: 0; font-weight: normal; cursor: pointer; line-height: 1.4; }
  .error { color: var(--vscode-errorForeground, #f48771); margin: 8px 0 4px; }
</style>
</head>
<body>

<div class="row">
  <label for="provider">Provider:</label>
  <select id="provider">
    ${providerOptions}
  </select>
</div>

<hr>

<!-- Understand Local -->
<div id="sec-local" class="section">
  <div class="radio-row">
    <input type="radio" id="localUseModel" name="localMode"${localIsModel ? ' checked' : ''}>
    <label for="localUseModel">Model:</label>
    <select id="localModelSelect"${localIsModel ? '' : ' disabled'}>
      ${localModelOptions}
    </select>
    <a href="#" id="modelHelp" class="help-link" title="Learn more about available models">?</a>
  </div>
  <div class="radio-row">
    <input type="radio" id="localUseCustom" name="localMode"${localIsModel ? '' : ' checked'}>
    <label for="localUseCustom">Custom GGUF File:</label>
    <input type="text" id="localModelPath" value="${escapeHtml(localCustomPath)}"${localIsModel ? ' disabled' : ''}>
    <button type="button" id="browse"${localIsModel ? ' disabled' : ''}>...</button>
  </div>
  <div class="row">
    <label for="localContextWindowSize">Context Window Size:</label>
    <input type="number" id="localContextWindowSize" value="${escapeHtml(String(s.localContextWindowSize))}" min="1024" step="1024">
  </div>
</div>

<!-- Understand Remote -->
<div id="sec-remote" class="section">
  <div class="row">
    <label for="remoteServer">Server:</label>
    <input type="text" id="remoteServer" value="${escapeHtml(s.remoteServer)}" placeholder="123.123.123.123:56767">
  </div>
</div>

<!-- LM Studio -->
<div id="sec-lmstudio" class="section">
  <div class="row">
    <label for="lmStudioServer">Server:</label>
    <input type="text" id="lmStudioServer" value="${escapeHtml(s.lmStudioServer)}">
  </div>
  <div class="row">
    <label for="lmStudioModel">Model:</label>
    <select id="lmStudioModel">
      ${s.lmStudioModel ? `<option value="${escapeHtml(s.lmStudioModel)}">${escapeHtml(s.lmStudioModel)}</option>` : '<option value="">(fetching models...)</option>'}
    </select>
  </div>
  <div id="lmStudioModelManualRow" class="row" style="display:none">
    <label>Model (manual):</label>
    <input type="text" id="lmStudioModelManual" placeholder="Enter model name manually">
  </div>
  <div class="ack-row">
    <input type="checkbox" id="lmStudioData"${s.lmStudioData ? ' checked' : ''}>
    <label for="lmStudioData">${escapeHtml(dataText)}</label>
  </div>
</div>

<!-- Ollama -->
<div id="sec-ollama" class="section">
  <div class="row">
    <label for="ollamaServer">Server:</label>
    <input type="text" id="ollamaServer" value="${escapeHtml(s.ollamaServer)}">
  </div>
  <div class="row">
    <label for="ollamaModel">Model:</label>
    <select id="ollamaModel">
      ${s.ollamaModel ? `<option value="${escapeHtml(s.ollamaModel)}">${escapeHtml(s.ollamaModel)}</option>` : '<option value="">(fetching models...)</option>'}
    </select>
  </div>
  <div id="ollamaModelManualRow" class="row" style="display:none">
    <label>Model (manual):</label>
    <input type="text" id="ollamaModelManual" placeholder="Enter model name manually">
  </div>
  <div class="ack-row">
    <input type="checkbox" id="ollamaData"${s.ollamaData ? ' checked' : ''}>
    <label for="ollamaData">${escapeHtml(dataText)}</label>
  </div>
</div>

<!-- ChatGPT -->
<div id="sec-chatgpt" class="section">
  <div class="row">
    <label for="chatGPTServer">Server:</label>
    <input type="text" id="chatGPTServer" value="${escapeHtml(s.chatGPTServer)}">
  </div>
  <div class="row">
    <label for="chatGPTApiKey">API Key:</label>
    <input type="password" id="chatGPTApiKey" value="${escapeHtml(s.chatGPTApiKey)}">
  </div>
  <div class="row">
    <label for="chatGPTModel">Model:</label>
    <select id="chatGPTModel">
      ${s.chatGPTModel ? `<option value="${escapeHtml(s.chatGPTModel)}">${escapeHtml(s.chatGPTModel)}</option>` : '<option value="">(enter API key above)</option>'}
    </select>
  </div>
  <div id="chatGPTModelManualRow" class="row" style="display:none">
    <label>Model (manual):</label>
    <input type="text" id="chatGPTModelManual" placeholder="Enter model name manually">
  </div>
  <div class="ack-row">
    <input type="checkbox" id="chatGPTData"${s.chatGPTData ? ' checked' : ''}>
    <label for="chatGPTData">${escapeHtml(dataText)}</label>
  </div>
  <div id="chatGPTFeeRow" class="ack-row"${s.chatGPTApiKey ? '' : ' style="display:none"'}>
    <input type="checkbox" id="chatGPTFee"${s.chatGPTFee ? ' checked' : ''}>
    <label for="chatGPTFee">${escapeHtml(feeText)}</label>
  </div>
</div>

<!-- Claude -->
<div id="sec-claude" class="section">
  <div class="row">
    <label for="claudeServer">Server:</label>
    <input type="text" id="claudeServer" value="${escapeHtml(s.claudeServer)}">
  </div>
  <div class="row">
    <label for="claudeApiKey">API Key:</label>
    <input type="password" id="claudeApiKey" value="${escapeHtml(s.claudeApiKey)}">
  </div>
  <div class="row">
    <label for="claudeModel">Model:</label>
    <select id="claudeModel">
      ${s.claudeModel ? `<option value="${escapeHtml(s.claudeModel)}">${escapeHtml(s.claudeModel)}</option>` : '<option value="">(enter API key above)</option>'}
    </select>
  </div>
  <div id="claudeModelManualRow" class="row" style="display:none">
    <label>Model (manual):</label>
    <input type="text" id="claudeModelManual" placeholder="Enter model name manually">
  </div>
  <div class="ack-row">
    <input type="checkbox" id="claudeData"${s.claudeData ? ' checked' : ''}>
    <label for="claudeData">${escapeHtml(dataText)}</label>
  </div>
  <div id="claudeFeeRow" class="ack-row"${s.claudeApiKey ? '' : ' style="display:none"'}>
    <input type="checkbox" id="claudeFee"${s.claudeFee ? ' checked' : ''}>
    <label for="claudeFee">${escapeHtml(feeText)}</label>
  </div>
</div>

<!-- Gemini -->
<div id="sec-gemini" class="section">
  <div class="row">
    <label for="geminiServer">Server:</label>
    <input type="text" id="geminiServer" value="${escapeHtml(s.geminiServer)}">
  </div>
  <div class="row">
    <label for="geminiApiKey">API Key:</label>
    <input type="password" id="geminiApiKey" value="${escapeHtml(s.geminiApiKey)}">
  </div>
  <div class="row">
    <label for="geminiModel">Model:</label>
    <select id="geminiModel">
      ${s.geminiModel ? `<option value="${escapeHtml(s.geminiModel)}">${escapeHtml(s.geminiModel)}</option>` : '<option value="">(enter API key above)</option>'}
    </select>
  </div>
  <div id="geminiModelManualRow" class="row" style="display:none">
    <label>Model (manual):</label>
    <input type="text" id="geminiModelManual" placeholder="Enter model name manually">
  </div>
  <div class="ack-row">
    <input type="checkbox" id="geminiData"${s.geminiData ? ' checked' : ''}>
    <label for="geminiData">${escapeHtml(dataText)}</label>
  </div>
  <div id="geminiFeeRow" class="ack-row"${s.geminiApiKey ? '' : ' style="display:none"'}>
    <input type="checkbox" id="geminiFee"${s.geminiFee ? ' checked' : ''}>
    <label for="geminiFee">${escapeHtml(feeText)}</label>
  </div>
</div>

<!-- Grok -->
<div id="sec-grok" class="section">
  <div class="row">
    <label for="grokServer">Server:</label>
    <input type="text" id="grokServer" value="${escapeHtml(s.grokServer)}">
  </div>
  <div class="row">
    <label for="grokApiKey">API Key:</label>
    <input type="password" id="grokApiKey" value="${escapeHtml(s.grokApiKey)}">
  </div>
  <div class="row">
    <label for="grokModel">Model:</label>
    <select id="grokModel">
      ${s.grokModel ? `<option value="${escapeHtml(s.grokModel)}">${escapeHtml(s.grokModel)}</option>` : '<option value="">(enter API key above)</option>'}
    </select>
  </div>
  <div id="grokModelManualRow" class="row" style="display:none">
    <label>Model (manual):</label>
    <input type="text" id="grokModelManual" placeholder="Enter model name manually">
  </div>
  <div class="ack-row">
    <input type="checkbox" id="grokData"${s.grokData ? ' checked' : ''}>
    <label for="grokData">${escapeHtml(dataText)}</label>
  </div>
  <div id="grokFeeRow" class="ack-row"${s.grokApiKey ? '' : ' style="display:none"'}>
    <input type="checkbox" id="grokFee"${s.grokFee ? ' checked' : ''}>
    <label for="grokFee">${escapeHtml(feeText)}</label>
  </div>
</div>

<!-- Other -->
<div id="sec-other" class="section">
  <div class="row">
    <label for="otherServer">Server:</label>
    <input type="text" id="otherServer" value="${escapeHtml(s.otherServer)}">
  </div>
  <div class="row">
    <label for="otherApiKey">API Key:</label>
    <input type="password" id="otherApiKey" value="${escapeHtml(s.otherApiKey)}" placeholder="Optional">
  </div>
  <div class="row">
    <label for="otherModel">Model:</label>
    <select id="otherModel">
      ${s.otherModel ? `<option value="${escapeHtml(s.otherModel)}">${escapeHtml(s.otherModel)}</option>` : '<option value="">(enter server above)</option>'}
    </select>
  </div>
  <div id="otherModelManualRow" class="row" style="display:none">
    <label>Model (manual):</label>
    <input type="text" id="otherModelManual" placeholder="Enter model name manually">
  </div>
  <div class="ack-row">
    <input type="checkbox" id="otherData"${s.otherData ? ' checked' : ''}>
    <label for="otherData">${escapeHtml(dataText)}</label>
  </div>
  <div id="otherFeeRow" class="ack-row"${s.otherApiKey ? '' : ' style="display:none"'}>
    <input type="checkbox" id="otherFee"${s.otherFee ? ' checked' : ''}>
    <label for="otherFee">${escapeHtml(feeText)}</label>
  </div>
</div>

<p id="globalError" class="error" style="display:none"></p>

<div class="buttons">
  <button type="button" class="secondary" id="cancel">Cancel</button>
  <button type="button" id="save">OK</button>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

const sectionMap = {
  'Understand Local':   'sec-local',
  'Understand Remote':  'sec-remote',
  'LM Studio':          'sec-lmstudio',
  'Ollama':             'sec-ollama',
  'ChatGPT (OpenAI)':   'sec-chatgpt',
  'Claude':             'sec-claude',
  'Gemini':             'sec-gemini',
  'Grok (xAI)':         'sec-grok',
  'Other':              'sec-other',
};

// Providers where API key field is shown and triggers fee row
const feeConfig = {
  'ChatGPT (OpenAI)': { keyId: 'chatGPTApiKey', dataId: 'chatGPTData', feeRowId: 'chatGPTFeeRow', feeId: 'chatGPTFee' },
  'Claude':           { keyId: 'claudeApiKey',   dataId: 'claudeData',  feeRowId: 'claudeFeeRow',  feeId: 'claudeFee'  },
  'Gemini':           { keyId: 'geminiApiKey',    dataId: 'geminiData',  feeRowId: 'geminiFeeRow',  feeId: 'geminiFee'  },
  'Grok (xAI)':       { keyId: 'grokApiKey',      dataId: 'grokData',    feeRowId: 'grokFeeRow',    feeId: 'grokFee'    },
  'Other':            { keyId: 'otherApiKey',      dataId: 'otherData',   feeRowId: 'otherFeeRow',   feeId: 'otherFee'   },
};

// Providers with data-only acknowledgment (no API key / fee)
const dataOnlyConfig = {
  'LM Studio': 'lmStudioData',
  'Ollama':    'ollamaData',
};

function updateFeeRow(provider) {
  const cfg = feeConfig[provider];
  if (!cfg) return;
  const hasKey = (document.getElementById(cfg.keyId)?.value ?? '').trim() !== '';
  const row = document.getElementById(cfg.feeRowId);
  if (row) row.style.display = hasKey ? '' : 'none';
}

function validate() {
  const provider = document.getElementById('provider').value;
  let errorMsg = ''; // blocks save
  let warnMsg  = ''; // shown but allows save

  if (provider === 'Understand Remote') {
    if (!(document.getElementById('remoteServer')?.value ?? '').trim())
      errorMsg = 'Host name or IP address required';
    else if (remoteVerifying)
      errorMsg = 'Verifying Provider...';
    else
      errorMsg = remoteVerifyError;
  } else if (provider !== 'Understand Local') {
    const verifyState = {
      'LM Studio':        { verifying: lmStudioVerifying, error: lmStudioVerifyError },
      'Ollama':           { verifying: ollamaVerifying,   error: ollamaVerifyError   },
      'ChatGPT (OpenAI)': { verifying: chatGPTVerifying,  error: chatGPTVerifyError  },
      'Claude':           { verifying: claudeVerifying,   error: claudeVerifyError   },
      'Gemini':           { verifying: geminiVerifying,   error: geminiVerifyError   },
      'Grok (xAI)':       { verifying: grokVerifying,     error: grokVerifyError     },
      'Other':            { verifying: otherVerifying,    error: otherVerifyError    },
    };
    const vs = verifyState[provider];
    if (vs) {
      if (vs.verifying)
        errorMsg = 'Verifying Provider...';
      else if (vs.error === 'Authentication required')
        errorMsg = vs.error;
      else if (vs.error)
        warnMsg = vs.error;
    }
    if (!errorMsg) {
      const modelSelectMap = {
        'LM Studio': 'lmStudioModel', 'Ollama': 'ollamaModel',
        'ChatGPT (OpenAI)': 'chatGPTModel', 'Claude': 'claudeModel',
        'Gemini': 'geminiModel', 'Grok (xAI)': 'grokModel', 'Other': 'otherModel',
      };
      const modelManualMap = {
        'LM Studio': 'lmStudioModelManual', 'Ollama': 'ollamaModelManual',
        'ChatGPT (OpenAI)': 'chatGPTModelManual', 'Claude': 'claudeModelManual',
        'Gemini': 'geminiModelManual', 'Grok (xAI)': 'grokModelManual', 'Other': 'otherModelManual',
      };
      const selectId = modelSelectMap[provider];
      if (selectId && !(val(modelManualMap[provider]) || val(selectId)).trim())
        errorMsg = 'Enter a model name to continue.';
    }
    if (!errorMsg) {
      const cfg = feeConfig[provider];
      const dataId = cfg ? cfg.dataId : dataOnlyConfig[provider];
      if (dataId && !document.getElementById(dataId)?.checked) {
        errorMsg = 'Agree to the acknowledgments to use this provider.';
      } else if (cfg) {
        const feeRow = document.getElementById(cfg.feeRowId);
        if (feeRow && feeRow.style.display !== 'none' && !document.getElementById(cfg.feeId)?.checked)
          errorMsg = 'Agree to the acknowledgments to use this provider.';
      }
    }
  }

  const msg = errorMsg || warnMsg;
  const errEl = document.getElementById('globalError');
  errEl.textContent = msg;
  errEl.style.display = msg ? '' : 'none';
  document.getElementById('save').disabled = !!errorMsg;
}

function showSection(provider) {
  Object.values(sectionMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = 'section';
  });
  const active = sectionMap[provider];
  if (active) document.getElementById(active).className = 'section visible';
  if (provider === 'Understand Remote') {
    const serverVal = (document.getElementById('remoteServer')?.value ?? '').trim();
    if (serverVal) startRemoteVerify(serverVal);
  }
  if (provider === 'LM Studio')
    fetchLmStudioModels(document.getElementById('lmStudioServer')?.value ?? '');
  if (provider === 'Ollama')
    fetchOllamaModels(document.getElementById('ollamaServer')?.value ?? '');
  if (provider === 'ChatGPT (OpenAI)')
    fetchChatGPTModels(document.getElementById('chatGPTServer')?.value ?? '', document.getElementById('chatGPTApiKey')?.value ?? '');
  if (provider === 'Claude')
    fetchClaudeModels(document.getElementById('claudeServer')?.value ?? '', document.getElementById('claudeApiKey')?.value ?? '');
  if (provider === 'Gemini')
    fetchGeminiModels(document.getElementById('geminiServer')?.value ?? '', document.getElementById('geminiApiKey')?.value ?? '');
  if (provider === 'Grok (xAI)')
    fetchGrokModels(document.getElementById('grokServer')?.value ?? '', document.getElementById('grokApiKey')?.value ?? '');
  if (provider === 'Other')
    fetchOtherModels(document.getElementById('otherServer')?.value ?? '', document.getElementById('otherApiKey')?.value ?? '');
  validate();
}

const providerSelect = document.getElementById('provider');
providerSelect.addEventListener('change', () => showSection(providerSelect.value));

// Remote server validation
let remoteVerifyTimer = null;
let remoteVerifying = false;
let remoteVerifyError = '';

let lmStudioVerifying = false;
let lmStudioVerifyError = '';
let ollamaVerifying = false;
let ollamaVerifyError = '';

function startRemoteVerify(server) {
  if (remoteVerifyTimer) clearTimeout(remoteVerifyTimer);
  if (!server.trim()) {
    remoteVerifying = false;
    remoteVerifyError = '';
    validate();
    return;
  }
  remoteVerifying = true;
  remoteVerifyError = '';
  validate();
  remoteVerifyTimer = setTimeout(() => {
    vscode.postMessage({ command: 'verifyRemote', server });
  }, 500);
}

document.getElementById('remoteServer').addEventListener('input', (e) => {
  startRemoteVerify(e.target.value);
});

// LM Studio model dropdown
const lmStudioSavedModel = ${JSON.stringify(s.lmStudioModel)};
let lmStudioFetchTimer = null;

function toggleManualRow(rowId, inputId, models, error, savedModel) {
  const show = models.length === 0 && error !== 'Authentication required';
  const row = document.getElementById(rowId);
  const input = document.getElementById(inputId);
  if (row) row.style.display = show ? '' : 'none';
  if (show && input && !input.value && savedModel) input.value = savedModel;
  if (!show && input) input.value = '';
}

function populateLmStudioModels(models) {
  const select = document.getElementById('lmStudioModel');
  const current = select.value || lmStudioSavedModel;
  select.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = current; opt.textContent = current || '(no models loaded)';
    select.appendChild(opt);
  } else {
    const list = (current && !models.includes(current)) ? [current, ...models] : models;
    list.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); });
    if (current) select.value = current;
  }
}

function fetchLmStudioModels(server) {
  if (lmStudioFetchTimer) clearTimeout(lmStudioFetchTimer);
  if (!server.trim()) { lmStudioVerifying = false; lmStudioVerifyError = ''; populateLmStudioModels([]); validate(); return; }
  lmStudioVerifying = true; lmStudioVerifyError = ''; validate();
  lmStudioFetchTimer = setTimeout(() => {
    vscode.postMessage({ command: 'fetchLmStudioModels', server });
  }, 300);
}

document.getElementById('lmStudioServer').addEventListener('input', (e) => {
  fetchLmStudioModels(e.target.value);
});

// Ollama model dropdown
const ollamaSavedModel = ${JSON.stringify(s.ollamaModel)};
let ollamaFetchTimer = null;

function populateOllamaModels(models) {
  const select = document.getElementById('ollamaModel');
  const current = select.value || ollamaSavedModel;
  select.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = current; opt.textContent = current || '(no models loaded)';
    select.appendChild(opt);
  } else {
    const list = (current && !models.includes(current)) ? [current, ...models] : models;
    list.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); });
    if (current) select.value = current;
  }
}

function fetchOllamaModels(server) {
  if (ollamaFetchTimer) clearTimeout(ollamaFetchTimer);
  if (!server.trim()) { ollamaVerifying = false; ollamaVerifyError = ''; populateOllamaModels([]); validate(); return; }
  ollamaVerifying = true; ollamaVerifyError = ''; validate();
  ollamaFetchTimer = setTimeout(() => {
    vscode.postMessage({ command: 'fetchOllamaModels', server });
  }, 300);
}

document.getElementById('ollamaServer').addEventListener('input', (e) => {
  fetchOllamaModels(e.target.value);
});

// ChatGPT model dropdown
const chatGPTSavedModel = ${JSON.stringify(s.chatGPTModel)};
let chatGPTFetchTimer = null;
let chatGPTVerifying = false;
let chatGPTVerifyError = '';

function populateChatGPTModels(models) {
  const select = document.getElementById('chatGPTModel');
  const current = select.value || chatGPTSavedModel;
  select.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = current; opt.textContent = current || '(enter API key above)';
    select.appendChild(opt);
  } else {
    const list = (current && !models.includes(current)) ? [current, ...models] : models;
    list.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); });
    if (current) select.value = current;
  }
}

function fetchChatGPTModels(server, apiKey) {
  if (chatGPTFetchTimer) clearTimeout(chatGPTFetchTimer);
  if (!apiKey.trim()) {
    chatGPTVerifying = false;
    chatGPTVerifyError = '';
    populateChatGPTModels([]);
    validate();
    return;
  }
  chatGPTVerifying = true;
  chatGPTVerifyError = '';
  validate();
  chatGPTFetchTimer = setTimeout(() => {
    vscode.postMessage({ command: 'fetchChatGPTModels', server, apiKey });
  }, 500);
}

document.getElementById('chatGPTApiKey').addEventListener('input', (e) => {
  fetchChatGPTModels(document.getElementById('chatGPTServer')?.value ?? '', e.target.value);
});

// Claude model dropdown
const claudeSavedModel = ${JSON.stringify(s.claudeModel)};
let claudeFetchTimer = null;
let claudeVerifying = false;
let claudeVerifyError = '';

function populateClaudeModels(models) {
  const select = document.getElementById('claudeModel');
  const current = select.value || claudeSavedModel;
  select.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = current; opt.textContent = current || '(enter API key above)';
    select.appendChild(opt);
  } else {
    const list = (current && !models.includes(current)) ? [current, ...models] : models;
    list.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); });
    if (current) select.value = current;
  }
}
function fetchClaudeModels(server, apiKey) {
  if (claudeFetchTimer) clearTimeout(claudeFetchTimer);
  if (!apiKey.trim()) { claudeVerifying = false; claudeVerifyError = ''; populateClaudeModels([]); validate(); return; }
  claudeVerifying = true; claudeVerifyError = ''; validate();
  claudeFetchTimer = setTimeout(() => { vscode.postMessage({ command: 'fetchClaudeModels', server, apiKey }); }, 500);
}
document.getElementById('claudeApiKey').addEventListener('input', (e) => {
  fetchClaudeModels(document.getElementById('claudeServer')?.value ?? '', e.target.value);
});

// Gemini model dropdown
const geminiSavedModel = ${JSON.stringify(s.geminiModel)};
let geminiFetchTimer = null;
let geminiVerifying = false;
let geminiVerifyError = '';

function populateGeminiModels(models) {
  const select = document.getElementById('geminiModel');
  const current = select.value || geminiSavedModel;
  select.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = current; opt.textContent = current || '(enter API key above)';
    select.appendChild(opt);
  } else {
    const list = (current && !models.includes(current)) ? [current, ...models] : models;
    list.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); });
    if (current) select.value = current;
  }
}
function fetchGeminiModels(server, apiKey) {
  if (geminiFetchTimer) clearTimeout(geminiFetchTimer);
  if (!apiKey.trim()) { geminiVerifying = false; geminiVerifyError = ''; populateGeminiModels([]); validate(); return; }
  geminiVerifying = true; geminiVerifyError = ''; validate();
  geminiFetchTimer = setTimeout(() => { vscode.postMessage({ command: 'fetchGeminiModels', server, apiKey }); }, 500);
}
document.getElementById('geminiApiKey').addEventListener('input', (e) => {
  fetchGeminiModels(document.getElementById('geminiServer')?.value ?? '', e.target.value);
});

// Grok model dropdown
const grokSavedModel = ${JSON.stringify(s.grokModel)};
let grokFetchTimer = null;
let grokVerifying = false;
let grokVerifyError = '';

function populateGrokModels(models) {
  const select = document.getElementById('grokModel');
  const current = select.value || grokSavedModel;
  select.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = current; opt.textContent = current || '(enter API key above)';
    select.appendChild(opt);
  } else {
    const list = (current && !models.includes(current)) ? [current, ...models] : models;
    list.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); });
    if (current) select.value = current;
  }
}
function fetchGrokModels(server, apiKey) {
  if (grokFetchTimer) clearTimeout(grokFetchTimer);
  if (!apiKey.trim()) { grokVerifying = false; grokVerifyError = ''; populateGrokModels([]); validate(); return; }
  grokVerifying = true; grokVerifyError = ''; validate();
  grokFetchTimer = setTimeout(() => { vscode.postMessage({ command: 'fetchGrokModels', server, apiKey }); }, 500);
}
document.getElementById('grokApiKey').addEventListener('input', (e) => {
  fetchGrokModels(document.getElementById('grokServer')?.value ?? '', e.target.value);
});

// Other model dropdown
const otherSavedModel = ${JSON.stringify(s.otherModel)};
let otherFetchTimer = null;
let otherVerifying = false;
let otherVerifyError = '';

function populateOtherModels(models) {
  const select = document.getElementById('otherModel');
  const current = select.value || otherSavedModel;
  select.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = current; opt.textContent = current || '(enter server above)';
    select.appendChild(opt);
  } else {
    const list = (current && !models.includes(current)) ? [current, ...models] : models;
    list.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; select.appendChild(opt); });
    if (current) select.value = current;
  }
}
function fetchOtherModels(server, apiKey) {
  if (otherFetchTimer) clearTimeout(otherFetchTimer);
  if (!server.trim()) { otherVerifying = false; otherVerifyError = ''; populateOtherModels([]); validate(); return; }
  otherVerifying = true; otherVerifyError = ''; validate();
  otherFetchTimer = setTimeout(() => { vscode.postMessage({ command: 'fetchOtherModels', server, apiKey }); }, 500);
}
document.getElementById('otherServer').addEventListener('input', (e) => {
  fetchOtherModels(e.target.value, document.getElementById('otherApiKey')?.value ?? '');
});
document.getElementById('otherApiKey').addEventListener('input', (e) => {
  fetchOtherModels(document.getElementById('otherServer')?.value ?? '', e.target.value);
});

// Manual model inputs: re-validate when user types
['lmStudioModelManual', 'ollamaModelManual', 'chatGPTModelManual', 'claudeModelManual', 'geminiModelManual', 'grokModelManual', 'otherModelManual'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', validate);
});

// Acknowledgment checkboxes
Object.values(feeConfig).forEach(cfg => {
  document.getElementById(cfg.dataId)?.addEventListener('change', validate);
  document.getElementById(cfg.feeId)?.addEventListener('change', validate);
});
Object.values(dataOnlyConfig).forEach(id => {
  document.getElementById(id)?.addEventListener('change', validate);
});

// API key changes: show/hide fee row + re-validate
Object.entries(feeConfig).forEach(([provider, cfg]) => {
  document.getElementById(cfg.keyId)?.addEventListener('input', () => {
    updateFeeRow(provider);
    validate();
  });
});

// Local model mode radio buttons
const localDefaultCustomPath = ${JSON.stringify(localDefaultCustomPath)};
function updateLocalMode() {
  const useModel = document.getElementById('localUseModel').checked;
  document.getElementById('localModelSelect').disabled = !useModel;
  const customInput = document.getElementById('localModelPath');
  customInput.disabled = useModel;
  document.getElementById('browse').disabled = useModel;
  if (!useModel && !customInput.value && localDefaultCustomPath)
    customInput.value = localDefaultCustomPath;
  if (useModel && localDefaultCustomPath && customInput.value === localDefaultCustomPath)
    customInput.value = '';
}
document.getElementById('localUseModel').addEventListener('change', updateLocalMode);
document.getElementById('localUseCustom').addEventListener('change', updateLocalMode);

document.getElementById('modelHelp').addEventListener('click', (e) => {
  e.preventDefault();
  vscode.postMessage({ command: 'openUrl', url: 'https://support.scitools.com/support/solutions/articles/70000680303-choosing-a-local-llm-for-understand' });
});

document.getElementById('browse').addEventListener('click', () => {
  vscode.postMessage({ command: 'browse' });
});

window.addEventListener('message', event => {
  if (event.data.command === 'browseResult')
    document.getElementById('localModelPath').value = event.data.path;
  if (event.data.command === 'verifyResult') {
    remoteVerifying = false;
    remoteVerifyError = event.data.error;
    validate();
  }
  if (event.data.command === 'lmStudioModels') {
    lmStudioVerifying = false; lmStudioVerifyError = event.data.error;
    populateLmStudioModels(event.data.models);
    toggleManualRow('lmStudioModelManualRow', 'lmStudioModelManual', event.data.models, event.data.error, lmStudioSavedModel);
    validate();
  }
  if (event.data.command === 'ollamaModels') {
    ollamaVerifying = false; ollamaVerifyError = event.data.error;
    populateOllamaModels(event.data.models);
    toggleManualRow('ollamaModelManualRow', 'ollamaModelManual', event.data.models, event.data.error, ollamaSavedModel);
    validate();
  }
  if (event.data.command === 'chatGPTModels') {
    chatGPTVerifying = false; chatGPTVerifyError = event.data.error;
    populateChatGPTModels(event.data.models);
    toggleManualRow('chatGPTModelManualRow', 'chatGPTModelManual', event.data.models, event.data.error, chatGPTSavedModel);
    validate();
  }
  if (event.data.command === 'claudeModels') {
    claudeVerifying = false; claudeVerifyError = event.data.error;
    populateClaudeModels(event.data.models);
    toggleManualRow('claudeModelManualRow', 'claudeModelManual', event.data.models, event.data.error, claudeSavedModel);
    validate();
  }
  if (event.data.command === 'geminiModels') {
    geminiVerifying = false; geminiVerifyError = event.data.error;
    populateGeminiModels(event.data.models);
    toggleManualRow('geminiModelManualRow', 'geminiModelManual', event.data.models, event.data.error, geminiSavedModel);
    validate();
  }
  if (event.data.command === 'grokModels') {
    grokVerifying = false; grokVerifyError = event.data.error;
    populateGrokModels(event.data.models);
    toggleManualRow('grokModelManualRow', 'grokModelManual', event.data.models, event.data.error, grokSavedModel);
    validate();
  }
  if (event.data.command === 'otherModels') {
    otherVerifying = false; otherVerifyError = event.data.error;
    populateOtherModels(event.data.models);
    toggleManualRow('otherModelManualRow', 'otherModelManual', event.data.models, event.data.error, otherSavedModel);
    validate();
  }
});

function val(id) { return document.getElementById(id)?.value ?? ''; }
function num(id) { return parseInt(document.getElementById(id)?.value ?? '0', 10) || 0; }

document.getElementById('save').addEventListener('click', () => {
  vscode.postMessage({
    command: 'save',
    settings: {
      provider:               val('provider'),
      localModelPath:         document.getElementById('localUseModel').checked ? val('localModelSelect') : val('localModelPath'),
      localContextWindowSize: num('localContextWindowSize'),
      remoteServer:           val('remoteServer'),
      lmStudioServer:         val('lmStudioServer'),
      lmStudioModel:          val('lmStudioModelManual') || val('lmStudioModel'),
      ollamaServer:           val('ollamaServer'),
      ollamaModel:            val('ollamaModelManual')   || val('ollamaModel'),
      chatGPTServer:          val('chatGPTServer'),
      chatGPTApiKey:          val('chatGPTApiKey'),
      chatGPTModel:           val('chatGPTModelManual')  || val('chatGPTModel'),
      claudeServer:           val('claudeServer'),
      claudeApiKey:           val('claudeApiKey'),
      claudeModel:            val('claudeModelManual')   || val('claudeModel'),
      geminiServer:           val('geminiServer'),
      geminiApiKey:           val('geminiApiKey'),
      geminiModel:            val('geminiModelManual')   || val('geminiModel'),
      grokServer:             val('grokServer'),
      grokApiKey:             val('grokApiKey'),
      grokModel:              val('grokModelManual')     || val('grokModel'),
      otherServer:            val('otherServer'),
      otherApiKey:            val('otherApiKey'),
      otherModel:             val('otherModelManual')    || val('otherModel'),
      lmStudioData:           document.getElementById('lmStudioData')?.checked ?? false,
      ollamaData:             document.getElementById('ollamaData')?.checked   ?? false,
      chatGPTData:            document.getElementById('chatGPTData')?.checked  ?? false,
      chatGPTFee:             document.getElementById('chatGPTFee')?.checked   ?? false,
      claudeData:             document.getElementById('claudeData')?.checked   ?? false,
      claudeFee:              document.getElementById('claudeFee')?.checked    ?? false,
      geminiData:             document.getElementById('geminiData')?.checked   ?? false,
      geminiFee:              document.getElementById('geminiFee')?.checked    ?? false,
      grokData:               document.getElementById('grokData')?.checked     ?? false,
      grokFee:                document.getElementById('grokFee')?.checked      ?? false,
      otherData:              document.getElementById('otherData')?.checked    ?? false,
      otherFee:               document.getElementById('otherFee')?.checked     ?? false,
    },
  });
});

document.getElementById('cancel').addEventListener('click', () => {
  vscode.postMessage({ command: 'cancel' });
});

showSection(providerSelect.value);
</script>
</body>
</html>`;
}
