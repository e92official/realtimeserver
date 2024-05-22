const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const open = require('open');
const WebSocket = require('ws');
const debounce = require('lodash.debounce');

let serverProcess;
let ws;
let statusBarItem;

function activate(context) {
  console.log('Activating extension...');

  // Create a status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'realtimeserver.toggleServer';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // Register commands
  context.subscriptions.push(vscode.commands.registerCommand('realtimeserver.startServer', () => {
    startServer(context);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('realtimeserver.stopServer', () => {
    stopServer();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('realtimeserver.toggleServer', () => {
    if (serverProcess) {
      stopServer();
    } else {
      startServer(context);
    }
  }));

  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket is not open');
      return;
    }

    const document = event.document;
    if (document.languageId === 'html' || document.languageId === 'javascript') {
      const text = document.getText();
      console.log('Sending updated content to WebSocket server');
      sendUpdate(text);
    }
  }));
}

function startServer(context) {
  if (serverProcess) {
    vscode.window.showInformationMessage('Server is already running.');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found.');
    return;
  }

  const document = editor.document;
  const filePath = document.uri.fsPath;
  const projectDir = path.dirname(filePath);

  const serverScriptPath = path.join(context.extensionPath, 'src', 'http_server.js');
  console.log(`Starting server script: ${serverScriptPath} with directory: ${projectDir}`);

  serverProcess = exec(`node ${serverScriptPath} "${projectDir}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error starting server: ${error.message}`);
      vscode.window.showErrorMessage(`Error starting server: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout: ${stdout}`);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`Server process exited with code ${code} and signal ${signal}`);
    serverProcess = null;
    updateStatusBar();
  });

  // Open the default browser with the local server URL
  console.log(`Opening browser with URL: http://localhost:8080`);
  open(`http://localhost:8080`)
    .then(() => console.log(`Browser opened successfully.`))
    .catch(err => console.error(`Failed to open browser: ${err.message}`));

  vscode.window.showInformationMessage('Server started on http://localhost:8080');

  // Establish WebSocket connection after a delay
  setTimeout(() => {
    ws = new WebSocket('ws://localhost:8081');

    ws.on('open', () => {
      console.log('Connected to WebSocket server');
    });

    ws.on('close', () => {
      console.log('Disconnected from WebSocket server');
      ws = null;
    });

    ws.on('error', (error) => {
      console.log('WebSocket error:', error);
    });
  }, 2000); // 2 seconds delay to ensure the WebSocket server is up

  updateStatusBar();
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGINT');
    serverProcess = null;
    vscode.window.showInformationMessage('Server stopped.');
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  updateStatusBar();
}

function updateStatusBar() {
  if (serverProcess) {
    statusBarItem.text = '$(vm-active) Realtime Server: On';
    statusBarItem.show();
  } else {
    statusBarItem.text = '$(vm-outline) Realtime Server: Off';
    statusBarItem.show();
  }
}

const sendUpdate = debounce((text) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('Sending updated content to WebSocket server');
    ws.send(text);
  } else {
    console.log('WebSocket is not open');
  }
}, 500); // 500ms debounce interval

function deactivate() {
  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }
  if (ws) {
    ws.close();
  }
  console.log('Deactivating extension...');
}

module.exports = {
  activate,
  deactivate
};
