/**
 * aichat - A generic and configurable AI chat plugin.
 * This version allows users to set their own API endpoint and response path
 * for the session, making it compatible with various AI model APIs.
 * All logic and configuration are self-contained within this plugin.
 */
(function() {
    if (!window.TerminalAPI) {
        return;
    }

    // --- Private Status, stored for only current session ---
    let sessionApiKey = null;
    let conversationHistory = [];
    // Private Default Value 
    const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
    const DEFAULT_RESPONSE_PATH = "candidates[0].content.parts[0].text";

    let apiEndpoint = DEFAULT_ENDPOINT;
    let responsePath = DEFAULT_RESPONSE_PATH;

    /**
     * Helper function, get value from path
     * @param {object} obj - Target Object 
     * @param {string} path - Path e.g. 'data.items[0].url' 
     * @returns {any} - value or undefined 
     */
    function getValueFromPath(obj, path) {
        if (!path) return undefined;
        return path.split(/[.\[\]]+/).filter(Boolean).reduce((o, k) => (o || {})[k], obj);
    }

    TerminalAPI.registerCommand('aichat', {
        exec: async (args) => {
            // --- 1. Configuration and Setting has the priority ---

            if (args[0] === '--config') {
                const endpointIndex = args.indexOf('--endpoint');
                const pathIndex = args.indexOf('--path');
                let configured = false;

                if (endpointIndex !== -1 && args[endpointIndex + 1]) {
                    apiEndpoint = args[endpointIndex + 1];
                    TerminalAPI.print(`Session API Endpoint set to: ${apiEndpoint}`, 'success');
                    configured = true;
                }
                if (pathIndex !== -1 && args[pathIndex + 1]) {
                    responsePath = args[pathIndex + 1];
                    TerminalAPI.print(`Session Response Path set to: ${responsePath}`, 'success');
                    configured = true;
                }

                if (!configured) {
                     TerminalAPI.print("Usage: aichat --config --endpoint <url> --path <response.path>", "error");
                }
                return;
            }

            if (args[0] === '--show-config') {
                TerminalAPI.print("--- Current AI Chat Session Config ---", 'highlight');
                TerminalAPI.print(`Endpoint: ${apiEndpoint}`);
                TerminalAPI.print(`Response Path: ${responsePath}`);
                TerminalAPI.print(`API Key Status: ${sessionApiKey ? 'Set for session' : 'Not set'}`);
                return;
            }

            if (args[0] === '--reset-config') {
                apiEndpoint = DEFAULT_ENDPOINT;
                responsePath = DEFAULT_RESPONSE_PATH;
                TerminalAPI.print("Configuration reset to default (Google Gemini Pro).", 'success');
                return;
            }

            if (args[0] === '--set-key') {
                if (args.length < 2 || !args[1]) {
                    TerminalAPI.print("Usage: aichat --set-key <YOUR_API_KEY>", "error");
                    return;
                }
                sessionApiKey = args[1];
                TerminalAPI.print("API Key has been set for the current session.", "success");
                TerminalAPI.print("It will be forgotten when you reload the page.", "hint");
                return;
            }

            // --- 2. Check API ---
            if (!sessionApiKey) {
                TerminalAPI.print("AI API key not set for this session.", "error");
                TerminalAPI.print("Please set it first using:", "hint");
                TerminalAPI.print("  aichat --set-key <YOUR_API_KEY>", "hint");
                return;
            }
            
            // --- 3. Check Session ---
            if (args[0] === '--new' || args[0] === '-n') {
                conversationHistory = [];
                TerminalAPI.print("New chat session started.", 'success');
                return;
            }
            
            if (args[0] === '--history') {
                TerminalAPI.print("--- Current Session History ---", "highlight");
                if (conversationHistory.length === 0) {
                    TerminalAPI.print("(No history in this session)");
                } else {
                    conversationHistory.forEach(turn => {
                        TerminalAPI.print(`[${turn.role}]: ${turn.parts[0].text}`);
                    });
                }
                return;
            }
            
            const prompt = args.join(' ');
            if (!prompt) {
                 TerminalAPI.print("Usage: aichat <your question>", "error");
                 return;
            }

            // --- Chat Logic ---
            TerminalAPI.print("AI is thinking...", 'info');

            const requestBody = { contents: [ ...conversationHistory, { role: "user", parts: [{ text: prompt }] }] };

            try {
                // Configurable endpoint and key 
                const response = await fetch(`${apiEndpoint}?key=${sessionApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
                }
                
                const data = await response.json();
                
                // Get Response Path 
                const aiResponse = getValueFromPath(data, responsePath);

                if (typeof aiResponse !== 'string' || aiResponse.trim() === '') {
                    TerminalAPI.print(`Error: Could not find a valid text string at the path '${responsePath}'.`, 'error');
                    TerminalAPI.print(`Received: ${JSON.stringify(data).substring(0, 200)}...`, 'hint');
                    return;
                }

                TerminalAPI.print(aiResponse, 'highlight');
                conversationHistory.push({ role: "user", parts: [{ text: prompt }] });
                conversationHistory.push({ role: "model", parts: [{ text: aiResponse }] });

            } catch (e) {
                TerminalAPI.print(`Request failed: ${e.message}`, 'error');
            }
        },
        manual: `NAME
  aichat - a configurable chat interface for AI models.

SYNOPSIS
  aichat --set-key <API_KEY>
  aichat --config --endpoint <URL> --path <response.path>
  aichat <prompt>

DESCRIPTION
  Starts a conversational chat with a user-configured AI model.
  The API key, endpoint, and response path are stored only for the current session.

CONFIGURATION
  --set-key <API_KEY>
    Sets the API key for the current session. This is required.

  --config --endpoint <URL> --path <dot.notation.path>
    Sets the API URL and the path to the text response in the result JSON.

  --show-config
    Displays the current session's configuration.
  
  --reset-config
    Resets the configuration to the default (Google Gemini Pro).

CHAT
  <prompt>      Sends your question to the AI.
  --new, -n     Starts a new, empty chat session.
  --history     Shows the history of the current chat session.`
    });
})();
