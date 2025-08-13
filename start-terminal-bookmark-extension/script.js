// script.js
const startTime = Date.now();
const output = document.getElementById("output");
const typedText = document.getElementById("typedText"); // This will show text before cursor OR full text with highlighted char
const blockCursor = document.querySelector(".typed-container .cursor"); // The '█'
const terminal = document.getElementById("terminal");
const promptSymbol = document.getElementById("promptSymbol");
const suggestionsContainer = document.getElementById("autocomplete-suggestions");
const editorView = document.getElementById("editor-view");
const editorTitleInput = document.getElementById("editor-title");
const editorUrlInput = document.getElementById("editor-url"); 
const editorStatus = document.getElementById("editor-status"); 
const supported_search_engine = ["google", "bing", "baidu"];
const backgroundContainer = document.getElementById("background-container");
const bgUploadInput = document.getElementById("bg-upload-input");

let control_cmd = false;
let commanding = false;
let input_mode = false;
let user_input_content = "";
let buffer = "";
let cursorPosition = 0; // Tracks the cursor position within the buffer
let isComposing = false; // For IME input

// Piping 
let isPiping = false;
let pipeBuffer = [];

let yankBuffer = ""; // Stores text for Ctrl+y pasting (yank)

// Config Var 
let configMode = "storage"; // Storage or Bookmarks, storage by default
let autosyncEnabled = false; // Control if two backends should be synced
const SETTINGS_FOLDER_NAME = '.settings';
const CONFIG_KEYS = ['aliases', 'environmentVars', 'theme', 'settings', 'cursorStyle'];

// Cursor style
let cursorStyle = 'block'; // To track the current cursor style

let activeGrepPattern = null;


let isEditing = false; 
let editingBookmarkId = null; 
let editingBookmarkTitle = null;

let activeEditor = null;
let unsavedChanges = false;
let vimMode = 'NORMAL';

let outputHistory = [];

let environmentVars = {};
let wgetJobs = {};
const SUDO_REQUIRED_COMMANDS = ['rm', 'apt'];

let default_mode = false;
let default_search_engine = "google";

let aliases = {};

let user = ""

const BROWSER_TYPE = detectBrowser();
let current = null;
let root = null;
let path = [];
let homeDirNode = null;

let full_path = null;

// Function to add privacy policy version 
const PRIVACY_POLICY_VERSION = "1.2";
const PRIVACY_POLICY_URL = "https://www.tianyibrad.com/docs/start_terminal_privacy_policy";

// Some related links
const GITHUB_REPO_URL = "https://github.com/BradleyBao/Start-Terminal"
const STORE_URL = "https://microsoftedge.microsoft.com/addons/detail/start-terminal/pkaikemmelhclbkndohcoffnenhhhihp"
const REPORT = "https://aka.bradleyproject.eu.org/sterminal_report"
const FEEDBACK = "https://aka.bradleyproject.eu.org/sterminal_feedback"

// chrome.bookmarks.getTree(bookmarkTree => {
//   get_fav(bookmarkTree);
// });

let promptTheme = "default"; // Default theme
let promptOpacity = .15; // Default opacity for the prompt

// let promptBgRandomAPI = "https://rpic.origz.com/api.php?category=pixiv";
let promptBgRandomAPI = "https://rpic.origz.com/api.php?category=aesthetic";

const start_terminal_ascii = [
"   ______           __     ______              _           __",
"  / __/ /____ _____/ /____/_  __/__ ______ _  (_)__  ___ _/ /",
" _\\ \\/ __/ _ `/ __/ __/___// / / -_) __/  ' \\/ / _ \\/ _ `/ / ",
"/___/\\__/\\_,_/_/  \\__/    /_/  \\__/_/ /_/_/_/_/_//_/\\_,_/_/  ",
"                                                             "
].join("\n");



function get_fav(bookmarks) {
  root = bookmarks[0];
  current = root;
  path = [root];

  update_user_path();
};

function update_user_path() {
  let displayPath;

  // This first part, for handling paths inside the home directory, is correct.
  if (path.length >= 2 && path[0] === root && path[1] === homeDirNode) {
    if (path.length === 2) {
      displayPath = "~";
    } else {
      displayPath = "~/" + path.slice(2).map(p => p.title).join("/");
    }
  } else {
    // --- THIS IS THE FIX ---
    // For all other paths, build them from the root '/'
    // We slice from 1 to ignore the main root node, which has no title.
    const pathString = path.slice(1).map(p => p.title).join("/");
    displayPath = "/" + pathString;
  }

  // The rest of the function remains the same.
  full_path = user;
  if (user !== "") {
    full_path += ": ";
  }
  full_path += displayPath;
  full_path +=  " $";
  promptSymbol.textContent = full_path;
}

// =================================================================
// 授权码流程 (Authorization Code Flow with PKCE) 的完整代码
// =================================================================
async function loginWithMicrosoft() {
    const MS_CLIENT_ID = 'b4f5f8f9-d040-45a8-8b78-b7dd23524b92'; // ⚠️ Client ID for Microsoft OAuth 2.0

    // --- PKCE Help Function ---
    // 1. 创建一个随机字符串作为 code_verifier
    function generateCodeVerifier() {
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        return btoa(String.fromCharCode.apply(null, randomBytes))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    // 2. 用 SHA-256 哈希 verifier 来创建 code_challenge
    async function generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(hashBuffer)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    // --- PKCE Help Function ---


    // 1. Generate PKCE code_verifier and code_challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);


    // 2. Construct Microsoft Authorization URL
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.append('client_id', MS_CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code'); // <--- 关键变化
    authUrl.searchParams.append('redirect_uri', chrome.identity.getRedirectURL());
    authUrl.searchParams.append('scope', 'https://graph.microsoft.com/User.Read');
    authUrl.searchParams.append('response_mode', 'query'); // <--- 推荐使用 'query'
    // Add PKCE parameters
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    console.log("Opening URL:", authUrl.href);
    print("Opening Microsoft login page...", "info");

    // 3. Start Web Auth (code)
    chrome.identity.launchWebAuthFlow({
        url: authUrl.href,
        interactive: true
    }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
            console.error("Auth Failed:", chrome.runtime.lastError?.message);
            
            print("Auth Failed: " + (chrome.runtime.lastError?.message || "Unknown Error"), "error");
            print("");

            done();
            return;
        }
        
        // 4. 从重定向URL中解析出 "code"
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');

        if (!code) {
            // 这里处理 redirectUrl 中返回的错误信息
            const error = url.searchParams.get('error_description') || "Failed to get code";
            console.error("Failed to get code:", error);
            print("Failed to get code: " + error, "error");
            // 可以在此处向用户显示更友好的错误信息
            if (error.includes("'token' is disabled")) {
                console.error("Failed to login, please contact the developer.");
                print("Failed to login, please contact the developer.", "error");
            }
            print("");
            done();
            return;
        }

        console.log("Successfully get code");
        print("Successfully get code", "success");

        // 5. Exchange to Access Token
        const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        const params = new URLSearchParams();
        params.append('client_id', MS_CLIENT_ID);
        params.append('scope', 'https://graph.microsoft.com/User.Read');
        params.append('code', code);
        params.append('redirect_uri', chrome.identity.getRedirectURL());
        params.append('grant_type', 'authorization_code');
        // Send verifier to verify
        params.append('code_verifier', codeVerifier);

        fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })
        .then(response => response.json())
        .then(tokenInfo => {
            if (tokenInfo.error) {
                console.error("Token Exchange Failed:", tokenInfo.error_description);
                print("Token Exchange Failed: " + tokenInfo.error_description, "error");
                print("");
                done();
                return Promise.reject(tokenInfo.error_description); // 中断链条
            }
            
            const accessToken = tokenInfo.access_token;
            console.log("Successfully get Access Token!");
            print("Successfully get Access Token", "success");

            // 6. 使用 Access Token 获取用户信息
            return fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
            .then(response => response.json())
            .then(userInfo => ({ userInfo, tokenInfo })); // 将两个结果一起向下传递
        })
        .then(({ userInfo, tokenInfo }) => { // 接收包含两个信息的对象
            if (userInfo.error) {
                console.error("Failed to get user info:", userInfo.error.message);
                print("Failed to get user info: " + userInfo.error.message, "error");
                return;
            }

            // --- 这是关键的保存逻辑 ---
            const expirationTime = Date.now() + (tokenInfo.expires_in * 1000);
            const msAuthData = { userInfo, tokenInfo, expirationTime };
            chrome.storage.sync.set({ msAuth: msAuthData }, () => {
              console.log('Microsoft auth data saved.');
            });
            // --- 保存逻辑结束 ---

            const user_info = userInfo.userPrincipalName || userInfo.displayName;
            print(`Welcome, ${user_info}`, "success");
            user = user_info;
            update_user_path();
            print("");
            done();
        })
        .catch(error => {
            // 确保不会因为我们中断链条而报错
            if (typeof error === 'string') return; 
            
            console.error("An Unknown Error occurred:", error);
            print("An Unknown Error occurred: " + (error.message || error), "error");
            print("");
            done();
        });
    });
    commanding = false;
}
// 调用函数
// loginWithMicrosoft();

// Helper function to set caret position in contenteditable elements
function setCaretAtOffset(element, offset) {
    const sel = window.getSelection();
    if (!sel) return; // No selection object
    const range = document.createRange();
    let charCount = 0;
    let found = false;

    function traverseNodes(node) {
        if (found) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const nextCharCount = charCount + node.textContent.length;
            if (offset >= charCount && offset <= nextCharCount) {
                range.setStart(node, offset - charCount);
                found = true;
            }
            charCount = nextCharCount;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (offset === charCount && node.childNodes.length === 0) {
                range.setStart(node, 0);
                found = true;
                return;
            }
            for (let i = 0; i < node.childNodes.length && !found; i++) {
                traverseNodes(node.childNodes[i]);
            }
        }
    }
    
    // Ensure element has focus before manipulating selection if it's the intended target
    if(document.activeElement !== element && (element === typedText || element.contains(document.activeElement))) {
      element.focus();
    }

    traverseNodes(element);

    if (found) {
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else { // Fallback: if specific offset not found, place at end or start
        try {
            range.selectNodeContents(element);
            range.collapse(offset > 0); // true for start, false for end
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
            // console.warn("Fallback caret setting failed", e);
        }
    }
     // Re-focus if not already focused, helps IME
    if (document.activeElement !== element) {
        element.focus();
    }
}


function listChildren(options) {
  if (!current || !current.children) {
    print("Error: current directory not available.", "error");
    return;
  }

  if (current.children.length === 0) {
    return;
  }

  if (options && options.l) {
    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', '');
    };
    current.children.forEach((child, index) => {
    const typeChar = child.children ? "d" : "-"; // 'd' for directory, '-' for file
    const date = child.dateAdded || child.dateGroupModified || Date.now();
    const formattedDate = formatDate(date);
    const isLastChild = (index === current.children.length - 1);
    const className = child.children ? 'folder' : (child.url && child.url.startsWith("javascript:") ? 'exec' : 'file');
    if (user !== "") {
      print(`${typeChar}rwxr-xr-x ${user} ${user} ${formattedDate} ${child.title}`, className, isLastChild);
    } else {
      print(`${typeChar}rwxr-xr-x root root ${formattedDate} ${child.title}`, className, isLastChild);
    }

    return;
  });
  } else {
    // Default listing
  current.children.forEach((child, index) => {
    const isLastChild = (index === current.children.length - 1);
    const className = child.children ? 'folder' : (child.url && child.url.startsWith("javascript:") ? 'exec' : 'file');
    // If the name is too long and no enough space, end this line with spaces and continued with a new line
    printLine(child.title, className, isLastChild);
  });
  };

  
  
}

// In script.js, place this before the 'const commands = { ... };' block

const manPages = {
  "ls": "NAME\n  ls - list directory contents\n\nSYNOPSIS\n  ls [-l]\n\nDESCRIPTION\n  List information about the bookmarks and folders (non-recursively).\n\n  -l\tuse a long listing format.",
  "cd": "NAME\n  cd - change the current directory\n\nSYNOPSIS\n  cd <directory>\n  cd ..\n\nDESCRIPTION\n  Change the current bookmark folder to <directory>. 'cd ..' moves to the parent folder.",
  "mv": "NAME\n  mv - move (rename) files\n\nSYNOPSIS\n  mv <source> <destination>\n\nDESCRIPTION\n  Renames <source> to <destination>, or moves <source> into <destination> if <destination> is an existing folder.",
  "cp": "NAME\n  cp - copy files and directories\n\nSYNOPSIS\n  cp [-r] <source> <destination>\n\nDESCRIPTION\n  Copies <source> to <destination>.\n\n  -r\tcopy directories recursively.",
  "find": "NAME\n  find - search for files in a directory hierarchy\n\nSYNOPSIS\n  find [path] -name <pattern>\n\nDESCRIPTION\n  Searches for bookmarks/folders matching the <pattern> within the given [path] or current directory.\n  The pattern can include a wildcard '*' (e.g., 'find -name \"*search*\").",
  "history": "NAME\n  history - display command history\n\nSYNOPSIS\n  history\n\nDESCRIPTION\n  Displays the list of previously executed commands.",
  "alias": "NAME\n  alias - create a shortcut for a command\n\nSYNOPSIS\n  alias\n  alias <name>='<command>'\n\nDESCRIPTION\n  'alias' with no arguments prints the list of aliases.\n  'alias name='command'' defines an alias 'name' for 'command'. Quotes are important for commands with spaces.",
  "unalias": "NAME\n  unalias - remove aliases\n\nSYNOPSIS\n  unalias <alias_name>\n\nDESCRIPTION\n  Removes the alias specified by <alias_name> from the list of defined aliases. This change is saved and will persist across sessions.",
  "touch": "NAME\n  touch - create a new, empty bookmark\n\nSYNOPSIS\n  touch <filename>\n\nDESCRIPTION\n  Creates a new bookmark with the given <filename> and a blank URL. If a bookmark with the same name already exists, the command does nothing.",
  "man": "NAME\n  man - format and display the on-line manual pages\n\nSYNOPSIS\n  man <command>\n\nDESCRIPTION\n  Displays the manual page for a given command.",
  "clear": "NAME\n  clear, cls - clear the terminal screen\n\nSYNOPSIS\n  clear\n  cls\n\nDESCRIPTION\n  Clears all previous output from the terminal screen.",
  "editlink": "NAME\n  editlink - change the URL of a bookmark\n\nSYNOPSIS\n  editlink <bookmark_name> <new_url>\n\nDESCRIPTION\n  Sets a new URL for the specified bookmark in the current directory. This is useful for updating links for bookmarks created with 'touch'.",
  "export": "NAME\n  export - set an environment variable\n\nSYNOPSIS\n  export <name>=<value>\n\nDESCRIPTION\n  Assigns <value> to the environment variable <name>. These variables can be used in commands with $name (e.g., `export Greet='Hello World'; echo $Greet`). Variables are now saved across sessions.",
  "env": "NAME\n  env - display environment variables\n\nSYNOPSIS\n  env\n\nDESCRIPTION\n  Prints a list of all currently set environment variables.",
  "tabs": "NAME\n  tabs - manage browser tabs\n\nSYNOPSIS\n  tabs [ls | close <id> | switch <id>]\n\nDESCRIPTION\n  Allows interaction with the browser's open tabs.\n\n  ls\t\tlist all open tabs with their IDs.\n  close <id>\tclose the tab with the specified ID.\n  switch <id>\tswitch to (activate) the tab with the specified ID.",
  "downloads": "NAME\n  downloads - manage browser downloads\n\nSYNOPSIS\n  downloads [ls]\n\nDESCRIPTION\n  Allows interaction with the browser's downloads.\n\n  ls\t\tlist recent downloads with their IDs.",
  "wget": "NAME\n  wget - download a file\n\nSYNOPSIS\n  wget <url>\n\nDESCRIPTION\n  Initiates a download for the given <url> and displays a progress bar.",
  "grep": "NAME\n  grep - filter input\n\nSYNOPSIS\n  <command> | grep <pattern>\n\nDESCRIPTION\n  Filters the output of another command, showing only the lines that contain the specified <pattern>. It is case-insensitive.\n  Example: `history | grep ls`",
  "unset": "NAME\n  unset - unset environment variables\n\nSYNOPSIS\n  unset <name>\n\nDESCRIPTION\n  Removes the environment variable specified by <name>. This action is permanent for the current and future sessions.",
};

const previousCommands = [];
let previousCommandIndex = 0;

// Function to escape HTML special characters
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;") // Ensure & is escaped first
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Finds URLs in a string and wraps them in <a> tags.
 * @param {string} text - The text to process.
 * @returns {{html: string, linksFound: boolean}} An object containing the new HTML string and a flag indicating if links were found.
 */
function linkify(text) {
    // A robust regex to find URLs (http, https, www)
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    let linksFound = false;

    // Use .replace() to find all URLs and wrap them in an <a> tag
    const html = text.replace(urlRegex, (url) => {
        linksFound = true;
        let href = url;
        // If the URL starts with 'www.', prepend 'http://' for the href attribute to make it a valid link
        if (href.startsWith('www.')) {
            href = 'http://' + href;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="terminal-link">${url}</a>`;
    });

    return { html, linksFound };
}

function updateInputDisplay() {
  if (isComposing) {
    blockCursor.style.display = "none";
    return;
  }

  const currentActiveElement = document.activeElement;
  const typedTextIsFocused = currentActiveElement === typedText || typedText.contains(currentActiveElement);

  if (cursorPosition === buffer.length) {
    typedText.textContent = buffer;
    blockCursor.style.display = "inline-block";
  } else {
    const charAtCursor = buffer[cursorPosition] || ' ';
    typedText.innerHTML =
      escapeHtml(buffer.substring(0, cursorPosition)) +
      `<span class="highlighted-char">${escapeHtml(charAtCursor)}</span>` +
      escapeHtml(buffer.substring(cursorPosition + 1));
    blockCursor.style.display = "none";
  }

  // After updating display, ensure the browser's caret/selection is also at cursorPosition
  // This helps with IME positioning consistency.
  // Only set caret if typedText was focused or body (implying typedText should be focused)
  if (typedTextIsFocused || currentActiveElement === document.body ) {
      setCaretAtOffset(typedText, cursorPosition);
  }
}

// Function to update the input display (typedText and blockCursor)
function updateInputDisplayHighlight() {
  if (isComposing) {
    blockCursor.style.display = "none";
    return;
  }

  let html = '';
  let bufferIndex = 0;

  // 内部辅助函数，用于处理一小块文本，并正确插入光标下的高亮字符
  const processChunk = (text, className = '') => {
    let chunkHtml = '';
    for (const char of text) {
      if (bufferIndex === cursorPosition && bufferIndex < buffer.length) {
        // 如果当前字符索引等于光标位置，则用高亮span包裹
        chunkHtml += `<span class="highlighted-char">${escapeHtml(char)}</span>`;
      } else {
        chunkHtml += escapeHtml(char);
      }
      bufferIndex++;
    }
    // 如果有CSS类名，用相应的span包裹整个块
    if (className) {
      return `<span class="${className}">${chunkHtml}</span>`;
    }
    return chunkHtml;
  };

  // 1. 首先处理注释：#号及其之后的所有内容
  const commentIndex = buffer.indexOf('#');
  let commandPart = buffer;
  let commentPart = '';

  if (commentIndex !== -1) {
    commandPart = buffer.substring(0, commentIndex);
    commentPart = buffer.substring(commentIndex);
  }

  // 2. 将命令部分分解成令牌（单词和空格）并处理
  const tokens = commandPart.match(/(\s+)|([^\s]+)/g) || [];
  let commandFound = false;

  for (const token of tokens) {
    if (/^\s+$/.test(token)) { // 如果是空格
      html += processChunk(token);
    } else { // 如果是单词
      if (!commandFound) {
        // 第一个单词是命令
        html += processChunk(token, 'cmd-highlight');
        commandFound = true;
      } else if (token.startsWith('-')) {
        // 以'-'开头的是选项
        html += processChunk(token, 'comment-highlight');
      } else {
        // 其他都是参数
        html += processChunk(token);
      }
    }
  }

  // 3. 处理注释部分
  if (commentPart) {
    html += processChunk(commentPart, 'comment-highlight');
  }

  // 4. 更新DOM
  typedText.innerHTML = html;

  // 5. 控制行尾闪烁光标的显示
  if (cursorPosition === buffer.length) {
    blockCursor.style.display = "inline-block";
  } else {
    blockCursor.style.display = "none";
  }

  // 6. 恢复浏览器内部的光标位置以保证输入法（IME）的正常工作
  const currentActiveElement = document.activeElement;
  const typedTextIsFocused = currentActiveElement === typedText || typedText.contains(currentActiveElement);
  if (typedTextIsFocused || currentActiveElement === document.body) {
    setCaretAtOffset(typedText, cursorPosition);
  }
}


// Function to measure character width
function getMonospaceCharacterWidth() {
    const span = document.createElement('span');
    span.textContent = ' '; // Use a common character, 'M' or 'W' could also be good.
    span.style.fontFamily = getComputedStyle(typedText).fontFamily || 'monospace';
    span.style.fontSize = getComputedStyle(typedText).fontSize || '16px';
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre'; // Important for accurate width of space

    document.body.appendChild(span); // Append to body to ensure it's rendered
    const width = span.getBoundingClientRect().width;
    document.body.removeChild(span);

    return width > 0 ? width : 8; // Fallback if width is 0
}

let CHARACTER_WIDTH = getMonospaceCharacterWidth();

function updateCharacterWidth() {
    CHARACTER_WIDTH = getMonospaceCharacterWidth();
}

function changeDir(nameParts) {
  const name = nameParts.join(' '); // Expecting an array, take the first part as the target
  if (!name) {
    print("cd: missing operand", "error");
    return;
  }

  if (name === "..") {
    if (path.length > 1) {
      path.pop();
      current = path[path.length - 1];
      saveCurrentPath();
    }
    update_user_path();
    return;
  }

  const target = findChildByTitle(current.children || [], name);
  if (target && target.children) { // Ensure it's a directory
    current = target;
    path.push(current);
    saveCurrentPath();
  } else if (target && !target.children) {
    print(`cd: ${name}: Not a directory`, "error");
  } else {
    print(`cd: ${name}: No such file or directory`, "error");
  }

  update_user_path();
  // buffer = ""; // Keep buffer for usability if cd fails
  // cursorPosition = 0;
  // updateInputDisplay();
}

function findChildByTitle(children, title) {
  return children.find(child => child.title === title && child.children); // Specifically for directories
}

function findChildByTitleFileOrDir(children, title) { // For general lookup (files or dirs)
  return children.find(child => child.title === title);
}

/**
 * Query or Create .setting bookmark folder 
 * @param {boolean} createIfMissing - if true, will create the folder if it doesn't exist
 * @returns {Promise<object|null>} return bookmark node of the settings folder or null if failed
 */
async function getOrCreateSettingsFolder(createIfMissing = false) {
    if (!homeDirNode) return null;
    let settingsFolder = (homeDirNode.children || []).find(child => child.title === SETTINGS_FOLDER_NAME);

    if (!settingsFolder && createIfMissing) {
        try {
            settingsFolder = await new Promise((resolve, reject) => {
                chrome.bookmarks.create({ parentId: homeDirNode.id, title: SETTINGS_FOLDER_NAME }, (newNode) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(newNode);
                });
            });
            // 创建后，需要刷新 homeDirNode 的子节点列表
            const homeDirUpdate = await new Promise(resolve => chrome.bookmarks.getSubTree(homeDirNode.id, results => resolve(results[0])));
            if (homeDirUpdate) homeDirNode = homeDirUpdate;

        } catch (e) {
            print(`Error creating .settings folder: ${e.message}`, "error");
            return null;
        }
    }
    return settingsFolder;
}

/**
 * 从 .settings 书签中读取一个配置项
 * @param {string} key - 配置项名称 (e.g., 'aliases')
 * @returns {Promise<any|null>} 返回解析后的数据或 null
 */
async function readSettingFromBookmark(key) {
    const settingsFolder = await getOrCreateSettingsFolder(false);
    if (!settingsFolder) return null;

    const configFile = (settingsFolder.children || []).find(child => child.title === key);
    if (configFile && configFile.url) {
        try {
            // 数据存储在URL的 hash 部分
            const rawJson = decodeURIComponent(configFile.url.split('#')[1] || '');
            return JSON.parse(rawJson);
        } catch (e) {
            console.error(`Error parsing setting from bookmark: ${key}`, e);
            return null;
        }
    }
    return null;
}

/**
 * 将一个配置项写入 .settings 书签
 * @param {string} key - 配置项名称
 * @param {any} value - 要写入的数据
 * @returns {Promise<boolean>} 返回是否成功
 */
async function writeSettingToBookmark(key, value) {
    const settingsFolder = await getOrCreateSettingsFolder(true);
    if (!settingsFolder) return false;

    const jsonValue = JSON.stringify(value, null, 2);
    // 使用 about:blank#... 的形式来存储数据，更安全、更标准
    const dataUrl = `about:blank#${encodeURIComponent(jsonValue)}`;

    const configFile = (settingsFolder.children || []).find(child => child.title === key);
    try {
        if (configFile) {
            await new Promise((resolve, reject) => {
                chrome.bookmarks.update(configFile.id, { url: dataUrl }, (node) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(node);
                });
            });
        } else {
            await new Promise((resolve, reject) => {
                chrome.bookmarks.create({ parentId: settingsFolder.id, title: key, url: dataUrl }, (node) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(node);
                });
            });
        }
        return true;
    } catch (e) {
        print(`Error writing setting to bookmark '${key}': ${e.message}`, "error");
        return false;
    }
}

/**
 * 统一的配置读取"路由器"
 * @param {string} key - 配置项名称
 * @returns {Promise<any>}
 */
async function getSetting(key) {
    if (configMode === 'bookmark') {
        const bookmarkSetting = await readSettingFromBookmark(key);
        // 如果书签模式下读取失败（可能文件不存在），则优雅地回退到 storage
        if (bookmarkSetting !== null) {
            return bookmarkSetting;
        }
        print(`[warn] bookmark config '${key}' missing, using stored defaults`, "warning");
    }
    
    // 默认或回退都从 storage 读取
    const storageData = await new Promise(resolve => chrome.storage.sync.get(key, resolve));
    return storageData[key];
}

/**
 * 统一的配置写入"路由器"
 * @param {string} key - 配置项名称
 * @param {any} value - 要写入的数据
 */
async function setSetting(key, value) {
    const primaryWrite = configMode === 'bookmark'
        ? writeSettingToBookmark(key, value)
        : new Promise(resolve => chrome.storage.sync.set({ [key]: value }, resolve));

    await primaryWrite;

    if (autosyncEnabled) {
        // 如果启用了自动同步，则也写入到另一个后端
        const secondaryWrite = configMode === 'bookmark'
            ? new Promise(resolve => chrome.storage.sync.set({ [key]: value }, resolve))
            : writeSettingToBookmark(key, value);
        await secondaryWrite;
    }
}


const commands = {
  google: (args, options) => {
    if (args.length === 0) return "Usage: google <query> [-b]";
    const query = args.join(" ");
    if (options.b) {
      // If -b option is used, open in a new tab
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
      return true;
    }
    location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return true;
  },
  bing: (args, options) => {
    if (args.length === 0) return "Usage: bing <query> [-b]";
    const query = args.join(" ");
    if (options.b) {
      // If -b option is used, open in a new tab
      window.open(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, '_blank');
      return true;
    }
    location.href = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    return true;
  },
  baidu: (args, options) => {
    if (args.length === 0) return "Usage: baidu <query> [-b]";
    const query = args.join(" ");
    if (options.b) {
      // If -b option is used, open in a new tab
      window.open(`https://www.baidu.com/s?wd=${encodeURIComponent(query)}`, '_blank');
      return true;
    }
    location.href = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
    return true;
  },
  goto: (args, options) => {
    // console.log(args, options);
    if (args.length === 0) return "Usage: goto <url> [-b]";
    const url = args.join(" ");
    // if target blank is needed, open in a new tab

    if (!/^https?:\/\//i.test(url)) {
      // Add a protocol if missing
      let rephrased_url = `https://${url}`; // Use https as default
      // if target blank is needed, open in a new tab
      if (options.b) {
        rephrased_url = `https://${url}`; // Use https as default
        window.open(rephrased_url, '_blank'); // Open in a new tab
      }
      else {
        location.href = rephrased_url; // Redirect to the URL
      }
      return true;
      // return "Error: URL must start with http:// or https://";
    }
    if (options.b) {
      window.open(url, '_blank'); // Open in a new tab
      return true;
    }
    location.href = url;
    return true;
  },
  youtube: (args, options) => {
    if (args.length === 0) return "Usage: youtube <query> [-b]";
    const query = args.join(" ");
    if (options.b) {
      // If -b option is used, open in a new tab
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
      return true;
    }
    location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    return true;
  },
  bilibili: (args, options) => {
    if (args.length === 0) return "Usage: bilibili <query> [-b]";
    const query = args.join(" ");
    if (options.b) {
      // If -b option is used, open in a new tab
      window.open(`https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`, '_blank');
      return true;
    }
    location.href = `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`;
    return true;
  },
  spotify: (args, options) => {
    if (args.length === 0) return "Usage: spotify <query> [-b]";
    const query = args.join(" ");
    if (options.b) {
      // If -b option is used, open in a new tab
      window.open(`https://open.spotify.com/search/${encodeURIComponent(query)}`, '_blank');
      return true;
    }
    location.href = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    return true;
  },
  ping: (args, options) => {
    // console.log(args, options);
    if (args.length === 0) return "Usage: ping <host> [-t] [-n <count>]";
    // let result = `Pinging ${args[0]}`;
    // if (options.t) result += " continuously";
    // if (options.n) result += ` ${options.n} times`;
    ping_func(args[0], options);
    awaiting();
    // return result;
  },
  locale: (args, options) => {
    // Get browser language
    print("");
    print("LANG="+navigator.languages);
    print("LANGUAGE="+navigator.languages);
    return "";
  },
  date: (args, options) => {
    const now = new Date();
    const formattedDate = now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    print("")
    print(`${formattedDate}`);
    return " ";
  },
  clear: {
    exec: () => clearOutput(),
    manual: 
`NAME
  clear, cls - clear the terminal screen

SYNOPSIS
  clear
  cls

DESCRIPTION
  Clears all previous output from the terminal screen.`
  },
  cls: {
    exec: () => clearOutput(),
    manual: 
`NAME
  clear, cls - clear the terminal screen

SYNOPSIS
  clear
  cls

DESCRIPTION
  Clears all previous output from the terminal screen.`
  },
  welcome: {
    exec: async () => {
      const manifest = chrome.runtime.getManifest();
      print(`Terminal Startup v${manifest.version} - ${detectBrowser()}`);
      print("Author: Tian Yi, Bao");
      print("");
      print("Type 'help' for a list of commands.");
      print("Type 'about' for more information about start-terminal.");
      print("");
      print("Default Search Engine:");
      print(`  - Current: ${default_search_engine}`, "highlight");
      print(`  - Current default mode: ${default_mode ? "on" : "off"}`, `${default_mode ? "success" : "warning"}`);
      print("  - Supported: google, bing, baidu");
      print("  - Change with: default <search engine|on|off>", "hint");
      print("");

      // 检查并显示隐私政策更新
      // const data = await new Promise(resolve => chrome.storage.sync.get('privacyPolicyVersion', resolve));
      // if (data.privacyPolicyVersion !== PRIVACY_POLICY_VERSION) {
      //   print("Our Privacy Policy has been updated.", "highlight");
      //   print(`Please review the changes at: ${PRIVACY_POLICY_URL}`, "info");
      //   print("Type 'privacy-ok' to dismiss this message.", "hint");
      //   print("");
      // }
    },
    manual: `NAME
  welcome - display the welcome message and version information.

SYNOPSIS
  welcome`
  },
  cursor: (args) => {
    const supportedStyles = ['block', 'bar', 'underline'];
    const style = args[0];

    if (!style) {
        return `Current cursor style: ${cursorStyle}. Supported: ${supportedStyles.join(', ')}.`;
    }

    if (supportedStyles.includes(style)) {
        applyCursorStyle(style);
        // chrome.storage.sync.set({ cursorStyle: style }); // Save the setting
        setSetting('cursorStyle', style);
        return `Cursor style set to ${style}.`;
    } else {
        return `Error: Style '${style}' not supported. Use one of: ${supportedStyles.join(', ')}`;
    }
  },
  ls: {
    exec: (args, options, pipedInput) => {
        // 1. Get ALL real items from the current directory first.
        let allItems = (current.children || []).map(child => ({
            title: child.title,
            node: child,
            className: child.children ? 'folder' : (child.url && child.url.startsWith("javascript:") ? 'exec' : 'file')
        }));

        // ★★★ NEW LOGIC: Filter items based on the '-a' option ★★★
        // If '-a' is NOT present, filter out items that start with '.'
        const itemsToDisplay = options.a 
            ? allItems 
            : allItems.filter(item => !item.title.startsWith('.'));
        
        // 3. Sort the filtered items alphabetically.
        itemsToDisplay.sort((a, b) => a.title.localeCompare(b.title));

        // 4. Proceed with the display logic using the correctly filtered list.
        if (options.l) { // Handle -l (long format)
            if (itemsToDisplay.length === 0) return [];
            return itemsToDisplay.map(item => {
                const owner = user || 'root';
                const ownerPadding1 = ' '.repeat(Math.max(0, 8 - getVisualWidth(owner)));
                const ownerPadding2 = ' '.repeat(Math.max(0, 8 - getVisualWidth(owner)));
                const typeChar = item.node.children ? "d" : "-";
                const date = new Date(item.node.dateAdded || item.node.dateGroupModified).toLocaleString('sv-SE').substring(0, 16);
                const perms = `<span class="output-line-inline">${typeChar}rwxr-xr-x ${owner}${ownerPadding1} ${owner}${ownerPadding2} ${date} </span>`;
                const title = `<span class="output-line-inline output-${item.className}">${escapeHtml(item.title)}</span>`;
                return perms + title;
            });
        }

        // Standard multi-column layout
        if (itemsToDisplay.length === 0) return [];
        
        const terminalWidth = Math.floor(output.clientWidth / CHARACTER_WIDTH);
        if (isNaN(terminalWidth) || terminalWidth <= 0) {
            return itemsToDisplay.map(i => `<span class="output-${i.className}">${escapeHtml(i.title)}</span>`);
        }
        const longestItemWidth = itemsToDisplay.reduce((max, item) => Math.max(max, getVisualWidth(item.title)), 0);
        const colWidth = longestItemWidth + 2;
        let numCols = Math.floor(terminalWidth / colWidth);
        if (numCols <= 1) {
            return itemsToDisplay.map(item => `<span class="output-${item.className}">${escapeHtml(item.title)}</span>`);
        }
        const numRows = Math.ceil(itemsToDisplay.length / numCols);
        const outputLines = [];
        for (let row = 0; row < numRows; row++) {
            let lineHtml = '';
            for (let col = 0; col < numCols; col++) {
                const index = row + col * numRows;
                if (index < itemsToDisplay.length) {
                    const item = itemsToDisplay[index];
                    const title = escapeHtml(item.title);
                    const currentVisualWidth = getVisualWidth(item.title);
                    const paddingNeeded = colWidth - currentVisualWidth;
                    const padding = ' '.repeat(paddingNeeded > 0 ? paddingNeeded : 0);
                    lineHtml += `<span class="output-line-inline output-${item.className}">${title}</span>${padding}`;
                }
            }
            outputLines.push(lineHtml);
        }
        return outputLines;
    },
    manual: "NAME\n  ls - list directory contents\n\nSYNOPSIS\n  ls [-l] [-a]\n\nDESCRIPTION\n  List information about the bookmarks and folders (non-recursively).\n\n  -l\tuse a long listing format.\n  -a\tdo not ignore entries starting with ."
  },
  cd: {
    exec: (args) => {
        // The original logic of the cd command is now inside the 'exec' property.
        if (args.length === 0) {
          return "Usage: cd <directory>";
        }
        const targetPath = args.join(' ');

        if (targetPath === "..") {
            if (path.length > 1) {
                path.pop();
                current = path[path.length - 1];
                saveCurrentPath();
            }
        } else {
            const result = findNodeByPath(targetPath);
            if (result && result.node && result.node.children) { // Ensure it's a directory
                current = result.node;
                path = result.newPathArray;
                saveCurrentPath();
            } else if (result && result.node && !result.node.children) {
                 print(`cd: ${targetPath}: Not a directory`, "error");
                 return false;
            } else {
                print(`cd: ${targetPath}: No such file or directory`, "error");
                return false;
            }
        }
        update_user_path();
    },
    manual: "NAME\n  cd - change the current directory\n\nSYNOPSIS\n  cd <directory>\n  cd ..\n\nDESCRIPTION\n  Change the current bookmark folder to <directory>. 'cd ..' moves to the parent folder."
  },
  pwd: {
    exec: () => "/" + path.slice(1).map(p => p.title).join("/"),
    manual: 
    `NAME
  pwd - print name of current/working directory

SYNOPSIS
  pwd

DESCRIPTION
  Print the full path of the current bookmark folder.`
  },
  mkdir: {
    exec: (args) => new Promise(async (resolve) => {
        if (args.length === 0) { print("Usage: mkdir <directory_name>"); return resolve(); }
        const dirName = args.join(" ");
        if (findChildByTitle(current.children || [], dirName)) {
            print(`mkdir: cannot create directory '${dirName}': File exists`);
            resolve(false);
            return resolve(false);
        }
        chrome.bookmarks.create({ parentId: current.id, title: dirName }, async (newFolder) => {
            if (chrome.runtime.lastError) {
                print(`Error creating directory: ${chrome.runtime.lastError.message}`, "error");
            } else {
                print(`Directory '${newFolder.title}' created.`);
                await refreshStateAfterModification(); // ★★★ Use the new refresh function
            }
            resolve();
        });
    }),
    manual: `NAME
  mkdir - make directories

SYNOPSIS
  mkdir <directory_name>

DESCRIPTION
  Create a new bookmark folder named <directory_name>.`
  },

  rm: {
    exec: (args, options) => new Promise(async (resolve) => {
        if (args.length === 0) { print("Usage: rm [-r] [-f] <name>"); return resolve(); }
        const targetName = args.join(" ");
        const target = findChildByTitleFileOrDir(current.children || [], targetName);
        if (!target) {
            if (options.f) return resolve();
            print(`rm: cannot remove '${targetName}': No such file or directory`);
            resolve(false);
            return resolve();
        }
        const isDirectory = !!target.children;
        const isRecursive = !!options.r;

        const removeCallback = async () => {
            if (chrome.runtime.lastError) {
                print(`Error removing '${targetName}': ${chrome.runtime.lastError.message}`, "error");
            } else {
                print(`Removed '${targetName}'.`);
            }
            await refreshStateAfterModification(); // ★★★ Use the new refresh function
            resolve();
        };

        if (isDirectory && isRecursive) {
            chrome.bookmarks.removeTree(target.id, removeCallback);
            return;
        }
        if (isDirectory && target.children.length > 0) {
            print(`rm: cannot remove '${targetName}': Is a directory. Use -r to remove recursively.`);
            return resolve();
        }
        chrome.bookmarks.remove(target.id, removeCallback);
    }),
    manual: `NAME
  rm - remove files or directories

SYNOPSIS
  rm [-r] [-f] <name>

DESCRIPTION
  Removes the specified bookmark or folder.

  -r    remove directories and their contents recursively.
  -f    force. Ignore nonexistent files, never prompt.`
  },
  rmdir: (args) => new Promise(async (resolve) => {
    if (args.length === 0) { print("Usage: rmdir <directory_name>"); return resolve(); }
    const dirName = args.join(" ");
    const target = findChildByTitleFileOrDir(current.children || [], dirName);
    if (!target) {
        print(`rmdir: failed to remove '${dirName}': No such directory`); 
        resolve(false);
        return resolve();
    }
    if (!target.children) {
        print(`rmdir: failed to remove '${dirName}': Not a directory`); 
        resolve(false);
        return resolve();
    }
    if (target.children.length > 0) {
        print(`rmdir: failed to remove '${dirName}': Directory not empty`); 
        resolve(false);
        return resolve();
    }
    chrome.bookmarks.remove(target.id, async () => {
        if (chrome.runtime.lastError) {
            print(`Error removing directory: ${chrome.runtime.lastError.message}`, "error");
        } else {
            print(`Removed directory '${dirName}'.`);
        }
        await refreshStateAfterModification(); // ★★★ Use the new refresh function
        resolve();
    });
  }),
  'privacy-ok' : (args, options) => {
    awaiting();
    chrome.storage.sync.set({ privacyPolicyVersion: PRIVACY_POLICY_VERSION }, () => {
        print("Thank you. The notice has been dismissed.", "success");
    });
    done();
  },
  // Theme 
  theme: {
    exec: (args, options) => {
        const supportedThemes = ['default', 'ubuntu', 'powershell', 'cmd', 'kali', 'debian'];
        const themeName = args[0];
        if (!themeName) {
            return `Current theme: ${promptTheme}. Supported: ${supportedThemes.join(', ')}.`;
        }
        if (supportedThemes.includes(themeName)) {
            applyTheme(themeName);
            return `Theme set to ${themeName}.`;
        } else {
            return `Error: Theme '${themeName}' not supported.`;
        }
    },
    suggestions: (args) => {
        if (args.length <= 1) {
            return ['default', 'ubuntu', 'powershell', 'cmd', 'kali', 'debian'];
        }
        return [];
    },
    manual: `NAME
  theme - change the terminal's color scheme

SYNOPSIS
  theme [<theme_name>]

DESCRIPTION
  Switches the visual theme of the terminal. If no theme is provided, it lists the current and available themes.

AVAILABLE THEMES
  default, ubuntu, powershell, cmd, kali, debian`
  },

  source: {
    exec: async (args) => {
      const targetFile = args[0] || '.startrc';

      if (targetFile !== '.startrc') {
        print(`source: only supports '.startrc' at the moment.`, 'error');
        return;
      }

      print(`Reloading ${targetFile}...`, 'info');
      const rcFile = await findFileInHome('.startrc');
      if (!rcFile) {
        print(`source: ${targetFile}: No such file or directory.`, 'error');
        return;
      }

      // 清空旧的别名和环境变量，以便重新加载
      aliases = {};
      environmentVars = {};

      try {
        const scriptContent = decodeURIComponent(rcFile.url.split('#')[1] || '');
        await parseAndApplyStartrc(scriptContent);
        print(`${targetFile} reloaded successfully.`, 'success');
      } catch (e) {
        print(`Error reading or applying ${targetFile}: ${e.message}`, 'error');
      }
    },
    manual: `NAME
  source - read and execute commands from a file

SYNOPSIS
  source <filename>

DESCRIPTION
  Reads and executes commands from <filename> in the current shell context.
  Currently, only 'source .startrc' is supported.`
  },

  config: {
    exec: async (args) => {
      const subCommand = args.shift() || 'status';
      const mode = args[0];

      switch (subCommand) {
        case 'setup':
          if (!['storage', 'bookmark', 'startrc'].includes(mode)) {
            print("Usage: config setup <storage|bookmark|startrc>", "error");
            return;
          }

          if (mode === 'startrc') {
            // --- 全新的 .startrc 设置流程 ---
            print("Setting up .startrc configuration mode...", "highlight");
            let imported = false;

            // 1. 检查并询问是否从 .settings 文件夹导入
            const settingsFolder = await getOrCreateSettingsFolder();
            if (settingsFolder) {
              const confirmImportBookmark = await userInputMode("Found legacy '.settings' folder. Import from it? [Y/n] ");
              print(`Found legacy '.settings' folder. Import from it? [Y/n] ${user_input_content}`);

              if (confirmImportBookmark) {
                const settingsToImport = {};
                for (const key of CONFIG_KEYS) {
                  settingsToImport[key] = await readSettingFromBookmark(key);
                }
                const startrcContent = generateStartrcContent(settingsToImport);
                await createOrUpdateStartrcFile(startrcContent);
                print("Successfully imported from .settings and created ~/.startrc.", "success");
                
                const confirmDelete = await userInputMode("Delete the old '.settings' folder? [Y/n] ");
                print(`Delete the old '.settings' folder? [Y/n] ${user_input_content}`);
                if (confirmDelete) {
                  await new Promise(resolve => chrome.bookmarks.removeTree(settingsFolder.id, resolve));
                  print("'.settings' folder removed.", "success");
                }
                imported = true;
              }
            }

            // 2. 如果未从书签导入，则询问是否从 storage 导入
            if (!imported) {
              const confirmImportStorage = await userInputMode("Import settings from browser storage? [Y/n] ");
              print(`Import settings from browser storage? [Y/n] ${user_input_content}`);

              if (confirmImportStorage) {
                const data = await new Promise(resolve => chrome.storage.sync.get(CONFIG_KEYS, resolve));
                const startrcContent = generateStartrcContent(data);
                await createOrUpdateStartrcFile(startrcContent);
                print("Successfully imported from storage and created ~/.startrc.", "success");
                imported = true;
              }
            }
            
            // 3. 如果都未导入，则创建默认文件
            if (!imported) {
                const confirmCreateDefault = await userInputMode("Create a default .startrc file? [Y/n] ");
                print(`Create a default .startrc file? [Y/n] ${user_input_content}`);
                if (confirmCreateDefault) {
                  await createOrUpdateStartrcFile(); // 不传参数，使用默认值
                  print("Created default ~/.startrc file.", "success");
                }
            }
            print("\nHint: You can now edit the config with: nano .startrc", "hint");

          } else if (mode === 'bookmark') {
            // --- 最终修复版本: 完整的交互式 bookmark 设置流程 ---
            print("Setting up bookmark configuration mode...", "highlight");

            let settingsFolder = await getOrCreateSettingsFolder(false); // 先检查，不创建

            if (settingsFolder) {
              print("'.settings' folder already exists. Mode switched.", "success");
            } else {
              // 如果文件夹不存在，开始询问流程
              const confirmCreation = await userInputMode("This will create a '.settings' folder in your bookmarks bar. Continue? [Y/n] ");
              print(`This will create a '.settings' folder in your bookmarks bar. Continue? [Y/n] ${user_input_content}`);

              if (!confirmCreation) {
                print("Operation aborted by user.", "warning");
                return; // 用户不同意，则完全中止
              }
              
              // 用户同意后，创建文件夹
              settingsFolder = await getOrCreateSettingsFolder(true);
              if (!settingsFolder) {
                print("Error: Could not create the ~/.settings folder.", "error");
                return;
              }
              print("Created '.settings' folder.", "success");

              // 然后询问是否从 storage 迁移
              const confirmMigration = await userInputMode("Migrate existing settings from browser storage? (No=create defaults) [Y/n] ");
              print(`Migrate existing settings from browser storage? (No=create defaults) [Y/n] ${user_input_content}`);

              let settingsToWrite;
              if (confirmMigration) {
                print("Migrating settings from storage...", "info");
                settingsToWrite = await new Promise(resolve => chrome.storage.sync.get(CONFIG_KEYS, resolve));
              } else {
                print("Creating default settings...", "info");
                settingsToWrite = {}; // 创建空对象，以便后面使用默认值
              }

              // 定义默认值，用于填充缺失的配置
              const defaultSettings = {
                aliases: {},
                environmentVars: {},
                theme: 'default',
                cursorStyle: 'block',
                settings: { default_mode: false, default_search_engine: "google" }
              };
              
              // 循环所有必需的键，确保写入
              const writePromises = [];
              for (const key of CONFIG_KEYS) {
                  const valueToWrite = settingsToWrite[key] ?? defaultSettings[key];
                  if (valueToWrite !== undefined) {
                      writePromises.push(writeSettingToBookmark(key, valueToWrite));
                  }
              }
              await Promise.all(writePromises);
              print("Configuration files created successfully.", "success");
            }

          } else if (mode === 'storage') {
            print("Switching to browser storage mode.", "info");
          }
          configMode = mode;
          await new Promise(resolve => chrome.storage.sync.set({ configMode: configMode }, resolve));
          print(`Configuration mode set to: ${configMode}`, "success");
          break;
        
        // ... 其他 case 保持不变 ...
        case 'status':
        default:
          print("--- Configuration Status ---", "highlight");
          print(`Current Mode: ${configMode}`);
          print(`Autosync:     ${autosyncEnabled ? 'ENABLED' : 'DISABLED'}`);
          print("\nAvailable modes: 'storage', 'bookmark', 'startrc' (recommended)", "hint");
          print("  config setup <mode> - Set the primary settings backend.");
          break;
      }
    },
    // ... suggestions 和 manual 部分保持不变 ...
    suggestions: (args) => {
      const subCommand = args[0];
      if (args.length <= 1) {
        return ['setup', 'sync', 'autosync', 'status'];
      }
      if (subCommand === 'setup' && args.length <= 2) {
        return ['startrc', 'storage', 'bookmark'];
      }
      return [];
    },
    manual: `NAME
  config - manage terminal configuration

SYNOPSIS
  config [setup <mode> | status]

DESCRIPTION
  Manages how and where terminal settings are stored.

  setup <startrc|storage|bookmark>
    Sets the primary settings backend.
    'startrc' (Recommended): Executes a ~/.startrc file on startup for maximum flexibility.
    'storage' (Legacy): Uses the browser's sync storage.
    'bookmark' (Legacy): Uses a hidden ~/.settings folder in your bookmarks bar.

  status
    Displays the current configuration mode.`
  },

  uploadbg: () => {
      bgUploadInput.click(); // Programmatically click the hidden file input
      print("Opening file picker. Please select an image to upload as background.", "info");
      awaiting();
      // return "File picker opened. Please select an image.";
  },

  setbgAPI: (args) => {
    const arg = args[0];
    // Check if it is the link 
    if (arg && (arg.startsWith("http://") || arg.startsWith("https://"))) {
        promptBgRandomAPI = arg;
        chrome.storage.sync.set({ imgAPI: promptBgRandomAPI });
        print(`Background image API set to ${arg}.`, "success");
        return;
    }
  },
  tree: (args, options) => {
    print(current.title || "~");
    if (current.children && current.children.length > 0) {
      current.children.forEach((child, index) => {
        const isLast = index === current.children.length - 1;
        displayTree(child, '', isLast);
      });
    }
    return ""; // Return empty string for a clean prompt return
  },
  cat: {
    exec: (args) => {
        if (args.length === 0) return "Usage: cat <bookmark_name>";
        const targetName = args.join(" ");
        const target = findChildByTitleFileOrDir(current.children || [], targetName);
        if (!target) return `cat: ${targetName}: No such file or directory`;
        if (target.children) return `cat: ${targetName}: Is a directory`;
        print("--- Bookmark Details ---", "highlight");
        print(`Title:    ${target.title}`);
        print(`URL:      ${target.url}`);
        if (target.dateAdded) print(`Added on: ${new Date(target.dateAdded).toLocaleString()}`);
        print("----------------------", "highlight");
        return "";
    },
    manual: `NAME
  cat - display bookmark details

SYNOPSIS
  cat <bookmark_name>

DESCRIPTION
  Displays the title, URL, and creation date of a specified bookmark.`
  },

  setbg: (args) => {
        const arg = args[0];
        if (arg === 'clear') {
            chrome.storage.local.remove('customBackground', () => {
                // 回到默认背景
                applyBackground(null, promptOpacity);
                print("Custom background cleared. Reverted to default.", "success");
            });
            return;
        }

        // 检查是否是设置透明度
        const opacityValue = parseFloat(arg);
        if (!isNaN(opacityValue) && opacityValue >= 0 && opacityValue <= 1) {
            promptOpacity = opacityValue;
            applyBackground(backgroundContainer.style.backgroundImage.slice(5, -2), opacityValue); // Re-apply current bg with new opacity
            chrome.storage.sync.set({ background_opacity: promptOpacity });
            return `Background opacity set to ${opacityValue}.`;
        }
        
        // 应用已上传的背景
        chrome.storage.local.get('customBackground', (data) => {
            if (data.customBackground) {
                applyBackground(data.customBackground, promptOpacity);
                print("Custom background applied.", "success");
            } else {
                print("No background image uploaded. Use 'uploadbg' first.", "warning");
            }
        });
    },

  default: (args, options) => {
    // Change the default search engine
    if (args.length === 0) {
      print(`Current default search engine is ${default_search_engine}`, "highlight");
      print(`Current default mode is ${default_mode ? "on" : "off"}`, `${default_mode ? "success" : "warning"}`);
      return "Usage: default <search engine> (google, bing, baidu)";
    }
    let arg = args[0];
    if (arg == "on") {
      default_mode = true;
      print("Default mode is on. ", "success");
      print("To turn it off, type 'default off'");
    } else if (arg == "off") {
      default_mode = false;
      print("Default mode is off. ", "success");
      print("To turn it on, type 'default on'");
    }
    else if (supported_search_engine.includes(arg)){
      default_search_engine = arg;
      if (!default_mode) {
        print(`Successfully changed default search engine to ${arg}`);
        print("If default mode is off, a command is required to search instead of directly inputting search content in the command prompt. You can turn it on by commanding 'default on'", "warning");
      }
    }
    else {
      print(`Unable to change default search engine: ${arg} is not supported.`, "error");
    }
    saveDefaultSettings();

  },
  mslogin: () => {
    print("Logging in with Microsoft");
    awaiting();
    commanding = true;
    loginWithMicrosoft();
  },
  mslogout: () => {
    logoutWithMicrosoft();
  },
  apt: (args) => {
    if (args.length === 0) {
      return;
    }
    let arg = args[0];
    if (arg == "update") {
      awaiting();
      commanding = true;
      checkForUpdates();
    } else if (arg == "upgrade") {
      awaiting();
      commanding = true;
      applyUpdates();
    }
  },
  "apt-get": (args) => {
    if (args.length === 0) {
      return;
    }
    let arg = args[0];
    if (arg == "update") {
      awaiting();
      commanding = true;
      checkForUpdates();
    } else if (arg == "upgrade") {
      awaiting();
      commanding = true;
      applyUpdates();
    }
  },
  history: {
    exec: () => {
        if (previousCommands.length === 0) return ["No history yet."];
        return previousCommands.map((cmd, index) => `${String(index + 1).padStart(3, ' ')}  ${cmd}`);
    },
    manual: `NAME
  history - display command history

SYNOPSIS
  history

DESCRIPTION
  Displays the list of previously executed commands.`
  },

  touch: {
    exec: (args) => new Promise(async (resolve) => {
        if (args.length === 0) { print("Usage: touch <filename>"); return resolve(); }
        const filename = args.join(" ");
        if (findChildByTitleFileOrDir(current.children || [], filename)) return resolve();
        
        chrome.bookmarks.create({ parentId: current.id, title: filename, url: "about:blank#touched" }, async (newItem) => {
            if (chrome.runtime.lastError) {
                print(`Error: ${chrome.runtime.lastError.message}`, "error");
            }
            await refreshStateAfterModification(); // ★★★ FIX IS HERE ★★★
            resolve();
        });
    }),
    manual: `NAME
  touch - create a new, empty bookmark

SYNOPSIS
  touch <filename>

DESCRIPTION
  Creates a new bookmark with the given <filename> and a blank URL. If a bookmark with the same name already exists, the command does nothing.`
  },
  editlink: {
    exec: (args) => new Promise((resolve) => {
        if (args.length < 2) {
            print("Usage: editlink <bookmark_name> <new_url>");
            return resolve();
        }
        const bookmarkName = args.shift(); 
        const newUrl = args.join(' ');
        const target = findChildByTitleFileOrDir(current.children || [], bookmarkName);
        if (!target) {
            print(`editlink: '${bookmarkName}': No such file or bookmark.`); return resolve();
        }
        if (target.children) {
            print(`editlink: '${bookmarkName}': Is a directory, cannot set a URL.`); return resolve();
        }
        chrome.bookmarks.update(target.id, { url: newUrl }, (updatedNode) => {
            if (chrome.runtime.lastError) {
                print(`Error updating link: ${chrome.runtime.lastError.message}`, "error");
            } else {
                print(`Updated link for '${updatedNode.title}'.`);
                print(`New URL: ${updatedNode.url}`, "success");
            }
            chrome.bookmarks.getSubTree(current.id, (results) => {
                if (results && results[0]) {
                    current = results[0];
                    path[path.length - 1] = current;
                }
                resolve();
            });
        });
    }),
    manual: `NAME
  editlink - change the URL of a bookmark

SYNOPSIS
  editlink <bookmark_name> <new_url>

DESCRIPTION
  Sets a new URL for the specified bookmark in the current directory. This is useful for updating links for bookmarks created with 'touch'.`
  },
  mv: {
    exec: async (args) => {
        if (args.length < 2) {
            print("Usage: mv <source> <destination_path>");
            return;
        }
        const sourceName = args[0];
        const destArg = args[1];

        const sourceNode = findChildByTitleFileOrDir(current.children || [], sourceName);
        if (!sourceNode) {
            print(`mv: cannot stat '${sourceName}': No such file or directory`);
            return;
        }

        // --- NEW PATH PARSING LOGIC ---
        let destPath = destArg;
        let newName = null;

        // If destArg ends with '/', it's definitely a directory path.
        if (destArg.endsWith('/')) {
            destPath = destArg.slice(0, -1) || '.'; // Handle case of just "/"
            newName = sourceNode.title; // Keep original name
        } else {
            const lastSlashIndex = destArg.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                destPath = destArg.substring(0, lastSlashIndex);
                newName = destArg.substring(lastSlashIndex + 1);
            } else {
                // No slash, means renaming in the current directory.
                destPath = '.';
                newName = destArg;
            }
        }
        if (newName === "") newName = sourceNode.title; // if path is like '~/folder/', newName is empty, so use original

        const destDirResult = findNodeByPath(destPath);

        if (!destDirResult || !destDirResult.node || !destDirResult.node.children) {
            print(`mv: cannot move '${sourceName}' to '${destArg}': Not a directory`);
            return;
        }

        // --- EXECUTION LOGIC ---
        const destParentId = destDirResult.node.id;

        // Step 1: Move the node to the new parent directory.
        await new Promise(resolve => {
            chrome.bookmarks.move(sourceNode.id, { parentId: destParentId }, (movedNode) => {
                if (chrome.runtime.lastError) {
                    print(`Error moving: ${chrome.runtime.lastError.message}`, "error");
                    resolve();
                    return;
                }
                // Step 2: If a new name is specified, update the title.
                if (newName && newName !== movedNode.title) {
                    chrome.bookmarks.update(movedNode.id, { title: newName }, resolve);
                } else {
                    resolve();
                }
            });
        });

        await refreshStateAfterModification();
    },
    manual: `NAME
  mv - move (rename) files

SYNOPSIS
  mv <source> <destination>

DESCRIPTION
  Renames <source> to <destination>, or moves <source> into <destination> if <destination> is an existing folder.`
  },

  cp: {
    exec: async (args, options) => {
        if (args.length < 2) return "Usage: cp [-r] <source> <destination_path>";
        const sourceName = args[0];
        const destArg = args[1];

        const sourceNode = findChildByTitleFileOrDir(current.children || [], sourceName);
        if (!sourceNode) return `cp: cannot stat '${sourceName}': No such file or directory`;
        if (sourceNode.children && !options.r) return `cp: -r not specified; omitting directory '${sourceName}'`;

        // --- NEW PATH PARSING LOGIC ---
        let destPath = destArg;
        let newName = null;
        
        if (destArg.endsWith('/')) {
            destPath = destArg.slice(0, -1) || '.';
            newName = sourceNode.title;
        } else {
            const lastSlashIndex = destArg.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                destPath = destArg.substring(0, lastSlashIndex);
                newName = destArg.substring(lastSlashIndex + 1);
            } else {
                destPath = '.';
                newName = destArg;
            }
        }
        if (newName === "") newName = sourceNode.title;

        const destDirResult = findNodeByPath(destPath);
        if (!destDirResult || !destDirResult.node || !destDirResult.node.children) {
            print(`cp: cannot copy '${sourceName}' to '${destArg}': Not a directory`);
            return;
        }

        // --- EXECUTION LOGIC ---
        try {
            await copyNodeRecursively(sourceNode, destDirResult.node.id, newName);
            await refreshStateAfterModification();
        } catch (e) {
            print(`Error copying: ${e.message}`, "error");
        }
    },
    manual: `NAME
  cp - copy files and directories

SYNOPSIS
  cp [-r] <source> <destination>

DESCRIPTION
  Copies <source> to <destination>.

  -r    copy directories recursively.`
  },
  find: {
    exec: (args, options) => {
    return new Promise(resolve => {
        if (args.length == 0) {
            print("Usage: find -name <pattern>");
            return resolve();
        }
        const namePattern = args.join(" ");
        const regex = new RegExp(namePattern.replace(/\*/g, '.*'), 'i');

        print(`Searching for '${namePattern}'...`);
        if (current.children) {
            current.children.forEach(child => {
                findRecursive(child, '.', regex);
            });
        }
        resolve();
    });
  },
  manual: `NAME
  find - search for files in a directory hierarchy

SYNOPSIS
  find -name <pattern>

DESCRIPTION
  Searches for bookmarks/folders matching the <pattern> within the current directory. The pattern can include a wildcard '*' (e.g., 'find -name "*search*").`
},

  alias: (args) => {
      if (args.length === 0) {
          if (Object.keys(aliases).length === 0) {
              return "No aliases defined.";
          }
          print("Current aliases:", "highlight");
          for (const name in aliases) {
              print(`  alias ${name}='${aliases[name]}'`);
          }
          return;
      }

      const aliasDef = args.join(' ');
      const match = aliasDef.match(/^([^=]+)='(.+)'$/);

      if (!match) {
          return "Usage: alias name='command'";
      }

      const name = match[1];
      const command = match[2];
      aliases[name] = command;
      // chrome.storage.sync.set({ aliases: aliases }); // Persist aliases
      setSetting('aliases', aliases);
      return `Alias '${name}' set.`;
  },
  unalias: (args) => {
      if (args.length === 0) {
          return "Usage: unalias <alias_name>";
      }
      const aliasName = args[0];

      if (aliases.hasOwnProperty(aliasName)) {
          delete aliases[aliasName]; // Remove the alias from our object
          // chrome.storage.sync.set({ aliases: aliases }); // Save the updated object to storage
          setSetting('aliases', aliases);
          return `Alias removed: ${aliasName}`;
      } else {
          return `unalias: no such alias: ${aliasName}`;
      }
  },
  
  man: (args, options) => {
      if (args.length === 0) {
          return "What manual page do you want?";
      }
      const page = args[0];
      const commandDef = commands[page];
      let content = null;

      // Priority 1: Check for the '.manual' property in the new command format.
      if (commandDef && typeof commandDef === 'object' && commandDef.manual) {
          content = commandDef.manual;
      } 
      // Priority 2: Fallback to the old manPages object for backward compatibility.
      else if (manPages[page]) {
          content = manPages[page];
      }

      if (!content) {
          return `No manual entry for ${page}`;
      }

      // The logic for printing the manual content remains the same.
      const lines = content.split('\n');
      lines.forEach(line => {
        // Simple formatting for headings (uppercase)
        if (line === line.toUpperCase() && line.length > 2) {
             print(line, "highlight");
        } else {
             print(line);
        }
      });
  },
  nano: (args) => {
    setupNanoEditor(args);
  },
  vim: (args) => {
    setupVimEditor(args);
  },
  export: (args) => {
    if (args.length === 0) {
        return "Usage: export VAR=value";
    }
    const assignment = args.join(' ');
    const match = assignment.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
        return "Invalid syntax. Use VAR=value format.";
    }
    const key = match[1];
    const value = match[2];
    environmentVars[key] = value;
    saveEnvironmentVars(); // Save to storage
    // No output on success, like bash
  },
  unset: (args) => {
    if (args.length === 0) {
        return "Usage: unset <VAR_NAME>";
    }
    const varName = args[0];
    if (environmentVars.hasOwnProperty(varName)) {
        delete environmentVars[varName];
        saveEnvironmentVars(); // Save the change
    } else {
        return `unset: ${varName}: not found`;
    }
  },
  env: (args, options, pipedInput) => {
    const output = [];
    for (const key in environmentVars) {
        output.push(`${key}=${environmentVars[key]}`);
    }
    // Also add dynamic user variable
    if (user) {
        output.push(`USER=${user}`);
    }
    return output; // Return array for piping
  },

  tabs: (args, options, pipedInput) => {
    const subCommand = args.shift() || 'ls';
    return new Promise(resolve => {
        switch (subCommand) {
            case 'ls':
                chrome.tabs.query({}, (tabs) => {
                    const output = tabs.map(tab => `[${tab.id}]\t${tab.title}`);
                    resolve(output);
                });
                break;
            case 'close':
                const closeId = parseInt(args[0], 10);
                if (isNaN(closeId)) {
                    resolve(["Usage: tabs close <id>"]);
                    return;
                }
                chrome.tabs.remove(closeId, () => resolve([]));
                break;
            case 'switch':
                const switchId = parseInt(args[0], 10);
                if (isNaN(switchId)) {
                    resolve(["Usage: tabs switch <id>"]);
                    return;
                }
                chrome.tabs.update(switchId, { active: true }, () => resolve([]));
                break;
            default:
                resolve([`Unknown subcommand '${subCommand}'. Use ls, close, switch.`]);
        }
    });
  },
  downloads: (args, options, pipedInput) => {
    const subCommand = args.shift() || 'ls';
    return new Promise(resolve => {
        switch (subCommand) {
            case 'ls':
                chrome.downloads.search({ limit: 20, orderBy: ['-startTime'] }, (items) => {
                    const output = items.map(item => `[${item.id}] ${item.filename} (${item.state})`);
                    resolve(output);
                });
                break;
            default:
                resolve([`Unknown subcommand '${subCommand}'. Use ls.`]);
        }
    });
  },
  wget: (args) => {
    if (args.length === 0) return "Usage: wget <url>";
    const url = args[0];

    awaiting();
    print(`Initiating download for: ${url}`);
    
    chrome.downloads.download({ url: url }, (downloadId) => {
        if (chrome.runtime.lastError) {
            print(`Download failed: ${chrome.runtime.lastError.message}`, "error");
            done();
            return;
        }

        const progressBarWidth = 40;
        let progress = 0;
        const progressBarDiv = document.createElement('div');
        output.appendChild(progressBarDiv);

        const interval = setInterval(() => {
            progress = Math.min(progress + Math.random() * 5, 99);
            const filledWidth = Math.round(progressBarWidth * (progress / 100));
            const emptyWidth = progressBarWidth - filledWidth;
            progressBarDiv.textContent = `[${'='.repeat(filledWidth)}>${' '.repeat(emptyWidth)}] ${Math.round(progress)}%`;
        }, 200);

        wgetJobs[downloadId] = { interval, div: progressBarDiv };
    });
    // This command is async and manages its own 'done()' call via the listener
  },

  grep: (args, options, pipedInput) => {
      if (args.length === 0) {
          return "Usage: grep <pattern>";
      }
      const pattern = new RegExp(args[0], 'i'); // Case-insensitive
      if (!pipedInput || !Array.isArray(pipedInput)) {
          return "grep: This command requires piped input.";
      }
      return pipedInput.filter(line => pattern.test(String(line)));
  },


  help: () => {
    print("");
    print("--- Terminal Help ---", "highlight");
    print("");

    print("Search Commands", "highlight");
    print("  google, bing, baidu, yt, ...  - Search on a specific engine.");
    print("  default <engine|on|off>       - Manage the default search behavior.");
    print("");
    
    print("Navigation & Bookmarks", "highlight");
    print("  ls [-la]                      - List bookmarks in the current directory.");
    print("  cd <folder>                   - Change directory.");
    print("  pwd                           - Show current bookmark path.");
    print("  goto <url> [-b]               - Navigate to a specific URL.");
    print("  tree                          - Display the directory tree structure.");
    print("  ./<bookmark_name>             - Open a bookmark in the current directory.");
    print("");

    print("File & Directory Operations", "highlight");
    print("  mkdir <folder>                - Create a new bookmark folder.");
    print("  touch <file>                  - Create a new, empty bookmark.");
    print("  mv <src> <dest>               - Move or rename a bookmark/folder.");
    print("  cp [-r] <src> <dest>          - Copy a bookmark or folder.");
    print("  rm [-r] <name>                - Remove a bookmark or folder.");
    print("  rmdir <folder>                - Remove an empty bookmark folder.");
    print("  find <path> -name <pattern>   - Find bookmarks/folders by name.");
    print("  cat <bookmark>                - Display details of a bookmark.");
    print("");
    
    print("Editors", "highlight");
    print("  nano <file>                   - Edit a bookmark or setting file with a simple editor.");
    print("  vim <file>                    - Edit a bookmark's raw data with a Vim-like editor.");
    print("");

    print("Browser & System Control", "highlight");
    print("  tabs <ls|close|switch>        - Manage browser tabs.");
    print("  downloads <ls>                - List recent downloads.");
    print("  wget <url>                    - Download a file from a URL.");
    print("  ping <host>                   - Ping a host.");
    print("  date                          - Show current date and time.");
    print("  clear (or cls)                - Clear the terminal screen.");
    print("");

    print("Shell, Environment & History", "highlight");

    print("  export VAR=value              - Set an environment variable.");
    print("  unset <VAR_NAME>              - Unset an environment variable.");
    print("  env                           - Display environment variables.");
    print("  grep <pattern>                - Filter piped input.");
    print("  history                       - Show command history.");
    print("  alias [name='cmd']            - Create or list command aliases.");
    print("  unalias <name>                - Remove an alias.");
    print("");
    
    print("Account, Customization & Meta", "highlight");
    print("  mslogin / mslogout            - Log in/out with a Microsoft account.");
    print("  theme <name>                  - Change terminal theme.");
    print("  cursor <style>                - Change cursor style (block, bar, underline).");
    print("  uploadbg / setbg              - Manage custom background.");
    print("  setbgAPI <url>                - Set the random background image API URL.");
    print("  config <setup|sync|...>       - Manage how and where settings are stored.");
    print("  apt <update|upgrade>          - Check for or apply extension updates.");
    print("  about [-V]                    - Show details about this extension.");
    print("  feedback                      - Provide feedback or rate the extension.");
    print("  man <command>                 - Show the manual page for a command.");
    print("");

    print("For more details on a command, type: man <command_name>", "hint");
    return ""; 
  },
  about: {
    exec: async (args, options) => {
    const manifest = chrome.runtime.getManifest();

    if (options.version || options.V || options.v) {
        print(`Terminal Startup v${manifest.version}`);
        print(`Privacy Policy Version v${PRIVACY_POLICY_VERSION}`);
        return;
    }

    // ASCII Art Title
    const titleArt = start_terminal_ascii.split('\n');

    titleArt.forEach(line => print(line, 'highlight'));
    print(""); // Spacer

    // Gather all details into an array of objects
    const details = [
        { label: "Version", value: manifest.version },
        { label: "Author", value: manifest.author },
        { label: "License", value: "MIT License" },
        { label: "Homepage", value: manifest.homepage_url },
        { label: "Repository", value: GITHUB_REPO_URL ? GITHUB_REPO_URL : "Not specified" },
        { label: "Privacy Policy", value: PRIVACY_POLICY_URL },
        { label: "Privacy Policy Version", value: PRIVACY_POLICY_VERSION },
        { label: "User", value: user || "guest" },
        { label: "Uptime", value: formatUptime(Date.now() - startTime) },
        { label: "Browser", value: `${BROWSER_TYPE}` },
        { label: "Language", value: navigator.language },
    ];

    const longestLabel = details.reduce((max, item) => Math.max(max, getVisualWidth(item.label)), 0);
    const urlLabels = ["Homepage", "Repository", "Privacy Policy"];

    // Print each detail in a formatted key-value pair
    details.forEach(item => {
        const padding = ' '.repeat(longestLabel - getVisualWidth(item.label));
        let displayValue;

        // --- START OF FIX ---
        // Check if the current item's label is one that should contain a URL.
        if (urlLabels.includes(item.label) && typeof item.value === 'string' && item.value.startsWith('http')) {
            // If it is a URL, create an anchor tag for it.
            displayValue = `<a href="${item.value}" target="_blank" rel="noopener noreferrer" class="terminal-link">${escapeHtml(item.value)}</a>`;
        } else {
            // For all other values, escape them to prevent any potential HTML injection.
            displayValue = escapeHtml(String(item.value));
        }
        // --- END OF FIX ---

        const line = `<span class="output-folder">${item.label}${padding}</span> : ${displayValue}`;
        print(line, 'info', true);
    });

    return ""; // Return nothing to avoid an extra blank line from the engine
  },
  feedback: async () => {
    print("How can we help?", "highlight");
    print("");
    print("[1] Rate The Extension");
    print("[2] Feedback");
    print("[3] Report a Bug or Suggest a Feature");
    print("");

    // Use the existing userInputMode to get the user's choice
    const choice = await userInputMode("Enter a number (or press any other key to cancel): ");
    
    // The user input content is stored in the global `user_input_content` variable
    // We need to echo it back so the user sees what they typed.
    print(`Enter a number (or press any other key to cancel): ${user_input_content}`);

    if (user_input_content === '1') {
        print("Opening the Add-on store page...", "info");
        window.open(STORE_URL, '_blank');
    }else if (user_input_content === '2') {
        print("Opening the feedback form...", "info");
        window.open(FEEDBACK, '_blank');
    } else if (user_input_content === '3') {
        print("Opening the reporting form...", "info");
        window.open(REPORT, '_blank');
    } else {
        print("Operation cancelled.", "warning");
    }
    return;
},
}
};

/**
 * Tokenizes a command line into segments based on logical operators.
 * @param {string} line - The full input line.
 * @returns {Array<object>} An array of command objects, e.g., [{ command: "cmd1", separator: "&&" }, ...]
 */
function tokenizeLine(line) {
    const regex = /(\s*&&\s*|\s*\|\|\s*|\s*;\s*)/g;
    const parts = line.split(regex);
    
    const tokens = [];
    for (let i = 0; i < parts.length; i += 2) {
        const command = parts[i].trim();
        // The separator is what FOLLOWS the command. The last command has no explicit separator.
        const separator = (parts[i + 1] || null)?.trim();
        if (command) {
            tokens.push({ command, separator });
        }
    }
    return tokens;
}

/**
 * Formats a duration in milliseconds to a human-readable string (e.g., "1m 23s").
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted uptime string.
 */
function formatUptime(ms) {
    if (ms < 1000) return `${ms}ms`;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    let result = '';
    if (minutes > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    return result;
}

/**
 * Recursively finds a node by its ID within a given tree.
 * @param {object} node - The starting node (e.g., the root).
 * @param {string} targetId - The ID of the node to find.
 * @param {array} currentPathArray - The path array leading to the starting node.
 * @returns {{node: object, path: array}|null}
 */
function findNodeById(node, targetId, currentPathArray) {
    if (node.id === targetId) {
        return { node: node, path: currentPathArray };
    }
    if (node.children) {
        for (const child of node.children) {
            const result = findNodeById(child, targetId, [...currentPathArray, child]);
            if (result) return result;
        }
    }
    return null;
}

/**
 * Performs a full state refresh after a bookmark modification.
 * Re-fetches the entire bookmark tree and rebuilds all path-related global variables.
 */
async function refreshStateAfterModification() {
    const currentId = current.id; // Save the ID of our current location

    // 1. Re-fetch the entire tree to get fresh data
    const bookmarkTree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
    
    // 2. Re-initialize global root variables
    root = bookmarkTree[0];
    homeDirNode = (root.children && root.children.length > 0) ? root.children[0] : root;

    // 3. Find our current location in the NEW tree and rebuild the path
    const result = findNodeById(root, currentId, [root]);

    if (result) {
        // If our current directory still exists, restore the state
        current = result.node;
        path = result.path;
    } else {
        // If our directory was deleted (e.g., by 'rm -r .'), go back to home
        current = homeDirNode;
        path = [root, homeDirNode];
    }
}

/**
 * Finds a bookmark node by a given path string (absolute or relative).
 * @param {string} pathStr The path string, e.g., "MyFolder" or "/Work/Projects".
 * @returns {{node: object, newPathArray: array}|null} The found node and its full path array, or null if not found.
 */
function findNodeByPath(pathStr) {
    if (!pathStr) return null;

    // Handle '.' as a special case for the current directory
    if (pathStr === '.') {
        return { node: current, newPathArray: path };
    }

    let startNode;
    let newPathArray;
    let pathSegments;

    // 1. Determine the starting point based on the path prefix
    if (pathStr.startsWith('~/')) {
        startNode = homeDirNode;
        newPathArray = [root, homeDirNode];
        pathSegments = pathStr.substring(2).split('/').filter(s => s.length > 0);
    } else if (pathStr.startsWith('/')) {
        startNode = root;
        newPathArray = [root];
        pathSegments = pathStr.substring(1).split('/').filter(s => s.length > 0);
    } else {
        startNode = current;
        newPathArray = [...path];
        pathSegments = pathStr.split('/').filter(s => s.length > 0);
    }

    if (pathSegments.length === 0) {
        return { node: startNode, newPathArray: newPathArray };
    }

    // 2. Traverse the path, ensuring all intermediate parts are directories
    let currentNode = startNode;
    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (!currentNode.children) return null; // Path is invalid

        if (segment === '..') {
            if (newPathArray.length > 1) newPathArray.pop();
            currentNode = newPathArray[newPathArray.length - 1] || root;
            continue;
        }

        const foundNode = currentNode.children.find(child => child.title === segment && child.children);
        if (foundNode) {
            currentNode = foundNode;
            newPathArray.push(currentNode);
        } else {
            return null; // An intermediate directory was not found
        }
    }

    // 3. Find the final part of the path, which can be a FILE or a DIRECTORY
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment === '..') {
        if (newPathArray.length > 1) newPathArray.pop();
        currentNode = newPathArray[newPathArray.length - 1] || root;
        return { node: currentNode, newPathArray: newPathArray };
    }
    
    const finalNode = findChildByTitleFileOrDir(currentNode.children || [], lastSegment);

    if (finalNode) {
        if (finalNode.children) newPathArray.push(finalNode);
        return { node: finalNode, newPathArray: newPathArray };
    }

    return null; // The final file/folder was not found
}


// Alias 
// commands.yt = commands.youtube;

// script.js

function setupNanoEditor(args) {
    if (args.length === 0) {
        print("Usage: nano <bookmark_name>");
        return;
    }
    const bookmarkName = args.join(' ');
    const target = findChildByTitleFileOrDir(current.children || [], bookmarkName);

    if (!target) {
        print(`nano: '${bookmarkName}': No such file.`);
        return;
    }
    if (target.children) {
        print(`nano: '${bookmarkName}': Is a directory.`);
        return;
    }

    isEditing = true;
    activeEditor = 'nano';
    editingBookmarkId = target.id;
    editingBookmarkTitle = target.title;
    unsavedChanges = false;
    
    // --- NANO .startrc 绿灯逻辑 ---
    const isStartrcFile = editingBookmarkTitle === '.startrc';
    const isSettingsFile = current.title === SETTINGS_FOLDER_NAME && CONFIG_KEYS.includes(editingBookmarkTitle);

    document.getElementById('nano-fields').style.display = 'none';
    const textarea = document.getElementById('editor-textarea');
    textarea.style.display = 'block'; // 总是显示文本区域
    textarea.readOnly = false;
    
    // 如果是 .startrc 或旧的配置文件，就从URL解码内容
    if (isStartrcFile || isSettingsFile) {
        try {
            const rawContent = decodeURIComponent(target.url.split('#')[1] || '');
            // 如果是旧的设置文件，美化一下JSON，否则直接显示内容
            textarea.value = isSettingsFile ? JSON.stringify(JSON.parse(rawContent), null, 2) : rawContent;
        } catch (e) {
            textarea.value = `Error parsing file content: ${e.message}. Saving will overwrite.`;
        }
    } else {
        // 对于普通书签，隐藏文本区，显示标题和URL输入框
        textarea.style.display = 'none';
        document.getElementById('nano-fields').style.display = 'block';
        editorTitleInput.value = target.title;
        editorUrlInput.value = target.url;
        setTimeout(() => editorTitleInput.focus(), 0);
    }
    
    if (textarea.style.display === 'block') {
      setTimeout(() => textarea.focus(), 0);
    }

    editorStatus.textContent = `Editing: ${target.title}`;
    document.getElementById('editor-footer').innerHTML = `<span class="editor-shortcut">^S</span> Save    <span class="editor-shortcut">^X</span> Exit`;
    
    terminal.style.display = "none";
    editorView.style.display = "flex";
}

function setupVimEditor(args) {
    if (args.length === 0) return "Usage: vim <bookmark_name>";
    const bookmarkName = args.join(' ');
    const target = findChildByTitleFileOrDir(current.children || [], bookmarkName);

    if (!target) return `vim: '${bookmarkName}': No such file.`;
    
    isEditing = true;
    activeEditor = 'vim';
    editingBookmarkId = target.id;
    unsavedChanges = false;
    vimMode = 'NORMAL';
    
    document.getElementById('nano-fields').style.display = 'none';
    const textarea = document.getElementById('editor-textarea');
    textarea.style.display = 'block';
    textarea.readOnly = true;

    // We use JSON.parse(JSON.stringify(...)) to get a clean, serializable copy of the object.
    const fullBookmarkData = JSON.parse(JSON.stringify(target));
    
    // We can optionally remove properties the user should never edit
    delete fullBookmarkData.children; // Never edit children array directly

    textarea.value = JSON.stringify(fullBookmarkData, null, 2);

    editorStatus.textContent = `Editing: ${target.title}`;
    document.getElementById('editor-footer').innerHTML = `<span>NORMAL MODE - Press 'i' to insert, ':' for commands</span>`;

    terminal.style.display = "none";
    editorView.style.display = "flex";
    setTimeout(() => textarea.focus(), 0);

    textarea.oninput = () => { unsavedChanges = true; };
}

function exitEditor() {
    if (unsavedChanges) {
        editorStatus.textContent = "Warning: Unsaved changes detected! Press ^X again to discard and exit.";
        // We add a temporary flag to allow exiting on the second try
        window.forceExit = true;
        setTimeout(() => { window.forceExit = false; }, 3000); // Flag resets after 3s
        return;
    }

    isEditing = false;
    editingBookmarkId = null;
    unsavedChanges = false;
    window.forceExit = false;

    editorView.style.display = "none";
    terminal.style.display = "block";
    done();
}

function parseCommandLine(input) {
  const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(t => t.replace(/^"|"$/g, "")) || [];
  if (tokens.length === 0) return null;

  const command = tokens.shift();
  const args = [];
  const options = {};

  const optionRequiresValue = {
      ping: ["n"],
      // Define other commands and their value-expecting options here if any
  };
  const commandSpecificOptionValues = optionRequiresValue[command] || [];

  for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith("-") && !token.startsWith("--")) { // Handle short options like -a, -l, -al
          const optString = token.substring(1); // e.g., "al" or "n"

          // Check if this is an option that expects a value (like 'ping -n 5')
          if (commandSpecificOptionValues.includes(optString) && tokens[i + 1] && !tokens[i + 1].startsWith("-")) {
              options[optString] = tokens[i + 1];
              i++; // Important: skip the next token as it's been consumed as a value
          } else {
              // ★★★ NEW LOGIC: Treat it as a set of single-character boolean flags ★★★
              for (const char of optString) {
                  options[char] = true; // This will set options['a']=true and options['l']=true
              }
          }
      } else if (token.startsWith("--")) { // Handle long options like --help (for future use)
           const optName = token.substring(2);
           options[optName] = true;
      } else {
          args.push(token);
      }
  }
  return { command, args, options };
}

function logoutWithMicrosoft() {
  chrome.storage.sync.remove('msAuth', () => {
      user = "";
      update_user_path();
      print("Logged out from Microsoft.", "success");
      print("");
      done();
    });
  }

// Add this helper function somewhere in your script.
function displayTree(node, prefix = '', isLast = true) {
  const nodeName = node.title || (node.url ? 'Untitled Bookmark' : 'Unknown');
  const connector = isLast ? '└── ' : '├── ';
  const className = node.children ? 'folder' : (node.url && node.url.startsWith("javascript:") ? 'exec' : 'file');
  print(`${prefix}${connector}${nodeName}`, className);

  if (node.children && node.children.length > 0) {
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child, index) => {
      const last = index === node.children.length - 1;
      displayTree(child, newPrefix, last);
    });
  }
};


async function ping_func(url, options) {
  print("");
  // Check if the URL has http or https protocol
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`; // 默认使用 http 协议
  }

  // Command running
  commanding = true;

  // save all pings results for calculate minimum, maximum, average
  let pingResults = [];
  let errorPings = 0;
  let allPings = 0;

  var p = new Ping();
  var times = options.n || 4; // 默认 ping 4 次
  if (options.t) {
    // 如果有 -t 参数，则持续 ping
    times = Infinity; // 设置为无限次
  }
  try {
    for (let i = 0; i < times; i++) {
      if (!commanding) {
        break; // Command Interrupted
      }
      const start = Date.now();
      await p.ping(url, (error, latency) => {
        allPings++;
        if (error) {
          console.error(`Failed to ping ${url}:`, error);
          print(`Failed to ping ${url}: ${error}`, "error");
          errorPings++;
          // commanding = false; // Reset command running state
          // done(); // Restore prompt
          // return;
        }
      }
      );
      const latency = Date.now() - start;
      print(`Reply from ${url}: ${latency} ms`);
      pingResults.push(latency);
      // Sleep for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

    }

  } catch (error) {
    console.error(`Failed to ping ${url}:`, error);
  }
  // Reset command running state
  commanding = false;

  // Calculate statistics
  if (pingResults.length > 0) {
    const min = Math.min(...pingResults);
    const max = Math.max(...pingResults);
    const avg = pingResults.reduce((sum, latency) => sum + latency, 0) / pingResults.length;
    print("");
    print(`Ping statistics for ${url}:`);
    print(`Packets: Sent = ${allPings}, Received = ${allPings - errorPings}, Lost = ${errorPings} (${(errorPings/allPings).toFixed(2)} loss)`);
    print(`Round Trip Times in milli-seconds (RTT):`);
    printLine(`Minimum = ${min} ms, `);
    printLine(`Maximum = ${max} ms, `);
    printLine(`Average = ${avg.toFixed(2)} ms`, "info", true);
  } else {
    print(`No successful pings to ${url}.`, "error");
  }

  print("");
  done();
}

// ! VERY IMPORTANT FUNCTION 
function print(text, type = "info", allowHtml = false) {

  if (isPiping) {
    pipeBuffer.push(text);
    return; // Divert output to the buffer and stop here.
  }

  // if (activeGrepPattern && !activeGrepPattern.test(String(text))) {
  //   return; // If it doesn't match, simply don't print.
  // }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = allowHtml ? String(text) : escapeHtml(String(text));
  if (activeGrepPattern && !activeGrepPattern.test(tempDiv.textContent || "")) {
    return; // If it doesn't match the visible text, don't print.
  }


  // 1. Record this print action to our history log
  outputHistory.push({ text, type, allowHtml });

  const lineDiv = document.createElement('div');
  lineDiv.className = `output-line output-line-powershell output-${type}`;

  const contentSpan = document.createElement('span');
  contentSpan.className = 'line-content';
  
  const content = String(text);
  if (allowHtml) {
    contentSpan.innerHTML = content;
  } else {
    // If plain text, use the safe linkify method.
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    let lastIndex = 0;
    let match;

    contentSpan.textContent = ''; // Clear span before appending nodes

    while ((match = urlRegex.exec(content)) !== null) {
      // Append the text before the link
      if (match.index > lastIndex) {
        contentSpan.appendChild(document.createTextNode(content.substring(lastIndex, match.index)));
      }
      
      // Create and append the link element
      const url = match[0];
      let href = url;
      if (href.startsWith('www.')) {
        href = 'http://' + href;
      }
      
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.className = 'terminal-link';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.appendChild(document.createTextNode(url)); // Use createTextNode for safety
      contentSpan.appendChild(anchor);

      lastIndex = urlRegex.lastIndex;
    }

    // Append any remaining text after the last link
    if (lastIndex < content.length) {
      contentSpan.appendChild(document.createTextNode(content.substring(lastIndex)));
    }
  }

  lineDiv.appendChild(contentSpan);
  output.appendChild(lineDiv);

  setTimeout(() => {
    const paddingSpan = document.createElement('span');
    paddingSpan.className = 'line-padding';

    const visualWidth = getVisualWidth(contentSpan.textContent || "");
    const terminalWidthChars = Math.floor(output.clientWidth / CHARACTER_WIDTH);
    
    let numSpaces = terminalWidthChars - visualWidth;
    
    paddingSpan.textContent = " ".repeat(Math.max(0, numSpaces));
    lineDiv.appendChild(paddingSpan);

    window.scrollTo(0, document.body.scrollHeight);
  }, 0);
}



function printLine(text, type = "info", endLine = false) {

  if (isPiping) {
    // For printLine, we need to handle how it builds a line.
    // For now, a simple push is sufficient. More complex logic can be added if needed.
    pipeBuffer.push(text);
    return;
  }

  if (activeGrepPattern && !activeGrepPattern.test(textStr)) {
      return; // If it doesn't match, simply don't print.
  }
  const lineWidth = output.clientWidth;
  const charWidth = CHARACTER_WIDTH;

  if (charWidth === 0) {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'output-line output-line-powershell';
    lineDiv.setAttribute(`data-raw-text`, String(text));
    lineDiv.textContent = String(text);
    output.appendChild(lineDiv);
    window.scrollTo(0, document.body.scrollHeight);
    return;
  }

  const textStr = String(text);

  const lineDiv = document.createElement('div');
  lineDiv.className = `output-line-inline output-line-powershell output-${type}`;
  lineDiv.setAttribute('data-raw-text', textStr); 

  // If endline is true
  if (endLine) {
    // Add spaces to fill the line
    const totalTextPixelWidth = textStr.length * charWidth;
    let numSpaces = 0;
    if (totalTextPixelWidth < lineWidth) {
      numSpaces = Math.floor((lineWidth - totalTextPixelWidth) / charWidth);
    } else {
      const lastLineActualPixelWidth = totalTextPixelWidth % lineWidth;
      if (lastLineActualPixelWidth === 0 && totalTextPixelWidth > 0) {
        numSpaces = 0;
      } else {
        numSpaces = Math.floor((lineWidth - lastLineActualPixelWidth) / charWidth);
      }
    }
    numSpaces = Math.max(0, numSpaces);
    const filledText = " ".repeat(numSpaces);
    // Remove filled text last space
    // filledText = filledText.substring(0, filledText.length);
    lineDiv.textContent = textStr + filledText; // Add spaces to fill the line
  } else {
  // If endline is false, just add a tab
  // Add a tab character to the end of the text

    lineDiv.textContent = textStr + "\t";
  }

  output.appendChild(lineDiv);
  window.scrollTo(0, document.body.scrollHeight);
}

// Function to rewrap a single line based on current width and character width
function rewrapLine(lineDiv) {
    if (CHARACTER_WIDTH === 0) return; // Avoid division by zero

    const rawText = lineDiv.getAttribute('data-raw-text');
    if (rawText === null) return;

    const textStr = String(rawText);
    const lineWidthChars = Math.floor(output.clientWidth / CHARACTER_WIDTH);

    if (textStr.length <= lineWidthChars) {
        lineDiv.textContent = textStr; // No wrapping needed
    } else {
        // Simple wrapping logic (can be improved for word boundaries)
        let wrappedText = "";
        for (let i = 0; i < textStr.length; i += lineWidthChars) {
            wrappedText += textStr.substring(i, Math.min(i + lineWidthChars, textStr.length)) + "\n";
        }
        lineDiv.textContent = wrappedText.trimEnd(); // Use textContent for pre-wrap to respect newlines
    }
}

async function proceedCommandCore(input) {
  const parsed = parseCommandLine(input);
  if (!parsed) {
      print("Invalid command syntax.", "error");
      return;
  }

  if (input.startsWith("./")) {
    let name = input.substring(2).trim();
    const target = findChildByTitleFileOrDir(current.children || [], name); // Use generalized finder
    if (target && target.url && !target.children) { // Ensure it's a bookmark (file) and has a URL
      if (target.url.startsWith("javascript:")) {
        print(`Executing JavaScript from bookmarks is disabled for security.`, "error");
        return;
      }
      location.href = target.url;
    } else if (target && target.children) {
      print(`${name}: Is a directory. Use 'cd' to navigate.`, "info");
    } else {
      print(`${name}: No such file or bookmark.`, "error");
    }
    return;
  }

  const { command, args, options } = parsed;
  const action = commands[command];

  if (action) {
    const result = action(args, options);
    if (result && typeof result.then === 'function') {
      await result;
    } else if (typeof result === "string") {
        print(result);
    } else if (result === false) {
        // Command handles its own output or is async
    } else if (result === true) {
        // Typically for navigation commands, no specific output needed here
    }
  } else {
    if (default_mode) {
      const defaultAction = commands[default_search_engine];
      if (defaultAction) {
        // Prepend the "unknown command" as the first argument to the search query
        const searchQueryArgs = [command, ...args];
        defaultAction(searchQueryArgs, options);
      } else {
         print(`Default search engine '${default_search_engine}' not found.`, "error");
         print(`Unknown command: '${command}' (try 'help')`, "error");
      }
    } else {
      print(`Unknown command: '${command}' (try 'help')`, "error");
    }
  }
  // if (!commanding) { // If not an async command like ping
  //   print(""); // Add a blank line for spacing after most command outputs
  // }
}

// wget download status 
chrome.downloads.onChanged.addListener((delta) => {
  if (wgetJobs[delta.id]) {
    if (delta.state && delta.state.current !== 'in_progress') {
      const { interval, div } = wgetJobs[delta.id];
      clearInterval(interval);
      const progressBarWidth = 40;
      if (delta.state.current === 'complete') {
        div.textContent = `[${'='.repeat(progressBarWidth + 1)}] 100% - Complete`;
      } else {
        div.textContent = `[${'x'.repeat(progressBarWidth + 1)}] - ${delta.state.current}`;
      }
      delete wgetJobs[delta.id];
      done(); // Restore prompt
    }
  }
});

// helper function for expandingVars
function expandVariables(input) {
  // Regex to find $VAR or ${VAR}
  return input.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([^}]+)\}/g, (match, var1, var2) => {
    const varName = var1 || var2;
    // We'll also add the USER variable dynamically
    if (varName === 'USER') return user;
    return environmentVars[varName] || ""; // Replace with value or empty string
  });
}

async function executePipeline(pipelineStr) {
    const pipedCommands = pipelineStr.split('|').map(c => c.trim());

    let previousOutput = null;

    for (let i = 0; i < pipedCommands.length; i++) {
        const commandStr = pipedCommands[i];
        if (!commandStr) continue;

        const isLastInPipe = i === pipedCommands.length - 1;

        const sudoCheckResult = handleSudoCheck(commandStr);
        if (!sudoCheckResult.canProceed) {
            previousOutput = null; // Break the pipe if sudo check fails
            continue;
        }
        let finalCommand = sudoCheckResult.finalCommand;
        
        finalCommand = expandVariables(finalCommand);
        const firstWord = finalCommand.split(' ')[0];
        if (aliases[firstWord]) {
            const aliasExpansion = aliases[firstWord];
            const restOfInput = finalCommand.substring(firstWord.length).trim();
            finalCommand = `${aliasExpansion} ${restOfInput}`.trim();
            if (isLastInPipe) {
                 print(`> ${finalCommand}`, "hint");
            }
        }
        
        if (finalCommand.startsWith("./")) {
            let name = finalCommand.substring(2).trim();
            const target = findChildByTitleFileOrDir(current.children || [], name);
            if (target && target.url && !target.children) {
                if (target.url.startsWith("javascript:")) {
                    print(`Executing JavaScript from bookmarks is disabled for security.`, "error");
                } else {
                    location.href = target.url;
                }
            } else if (target && target.children) {
                print(`${name}: Is a directory. Use 'cd' to navigate.`, "info");
            } else {
                print(`${name}: No such file or bookmark.`, "error");
            }
            previousOutput = null; // Break the pipe
            continue;
        }

        const parsed = parseCommandLine(finalCommand);
        if (!parsed) {
            if (isLastInPipe) print("Invalid command syntax.", "error");
            previousOutput = null;
            continue;
        }

        const { command, args, options } = parsed;
        const commandDef = commands[command];
        const action = (typeof commandDef === 'function') ? commandDef : commandDef?.exec; // Handle both old and new format

        if (action) {

            let result;
            if (!isLastInPipe) {
                // If this is not the last command, turn on piping mode
                isPiping = true;
                pipeBuffer = [];
            }

            result = await Promise.resolve(action(args, options, previousOutput, isLastInPipe));
            previousOutput = result;

            if (isPiping) {
                isPiping = false; // Turn off piping mode after the command runs
                // Use the explicit return value if it exists (for ls, history, etc.),
                // otherwise use what was captured from print() calls (for help, about, etc.).
                previousOutput = Array.isArray(result) && result.length > 0 ? result : pipeBuffer;
            } else {
                // This is the last command, so we print its result.
                if (result) {
                    if (typeof result === 'string') {
                        const isLsGrid = result.includes('class="ls-grid-container"');
                        print(result, 'info', isLsGrid);
                    } else if (Array.isArray(result)) {
                        result.forEach(line => {
                            const lineStr = String(line);
                            const allowHtml = lineStr.includes('<') && lineStr.includes('>');
                            print(lineStr, 'info', allowHtml);
                        });
                    }
                }
            }
        } else {
             if (isLastInPipe) {
                if (default_mode) {
                    const defaultAction = commands[default_search_engine];
                    if (defaultAction) {
                        defaultAction([command, ...args], options);
                    }
                } else {
                    print(`Unknown command: '${command}'`, "error");
                }
            }
            previousOutput = null;
        }
    }
    activeGrepPattern = null; // Reset grep pattern after processing the pipeline
}

// in script.js, add this new helper function

/**
 * Checks if a command requires sudo and if it was used correctly.
 * @param {string} originalCommandStr The raw command string from the user.
 * @returns {{canProceed: boolean, finalCommand: string}} An object indicating if execution can proceed,
 * and the command string with 'sudo' stripped off if it was present.
 */
function handleSudoCheck(originalCommandStr) {
    let useSudo = false;
    let commandToProcess = originalCommandStr.trim();

    if (commandToProcess.startsWith('sudo ')) {
        useSudo = true;
        commandToProcess = commandToProcess.substring(5).trim(); // Get the actual command
    }

    // We need to parse the command to check its name and options
    const parsed = parseCommandLine(commandToProcess);
    if (!parsed) {
        // If parsing fails, let the main loop handle the syntax error
        return { canProceed: true, finalCommand: commandToProcess };
    }

    const { command, options, args } = parsed;

    // --- The actual permission check ---

    // Special case: 'rm -r' requires sudo
    if (command === 'rm' && options.r && !useSudo) {
        const target = args.join(' ') || '[directory]';
        print(`rm: cannot remove '${target}': Permission denied`, "error");
        print(`This command would recursively delete '${target}', are you sudo? `, "hint")
        return { canProceed: false, finalCommand: null }; // Block execution
    }

    // General case for other commands in the sudo list
    // We exclude 'rm' here because its sudo requirement is specifically for the -r option.
    if (SUDO_REQUIRED_COMMANDS.includes(command) && command !== 'rm' && !useSudo) {
        const userName = user || 'guest';
        print(`Sorry, user ${userName} may not run '${command}' as root.`, "error");
        print(`This incident will be reported.`, "info"); // The classic sudo error
        return { canProceed: false, finalCommand: null }; // Block execution
    }

    // If all checks pass, allow execution
    return { canProceed: true, finalCommand: commandToProcess };
}

async function executeLine(line) {

    // Comments 
    const originalLineToPrint = line;
    line = line.split('#')[0].trim(); // Remove comments

    if (line.trim() === "") {
        print(`${full_path} ${originalLineToPrint}`); // Print the original line with comments
        print("");
        done();
        return;
    }
    
    // print(`${full_path} ${line}`);
    print(`${full_path} ${originalLineToPrint}`);

    const commandTokens = tokenizeLine(line);
    let lastCommandSuccess = true;

    awaiting();

    for (const token of commandTokens) {
        
        // --- Decision Block: Decide whether to run the current command ---
        if (lastCommandSuccess) {
            // If the PREVIOUS command succeeded...
            // We run the current command. The only exception is if the previous separator was '||',
            // in which case the OR chain has already succeeded, so we start skipping.
            if (token.previousSeparator === '&&') {
                lastCommandSuccess = true; // The success of the OR chain carries forward
                continue; // Skip this command
            }
        } else { // if lastCommandSuccess is false
            // If the PREVIOUS command failed...
            // We run the current command UNLESS the previous separator was '&&'.
            if (token.previousSeparator === '||') {
                lastCommandSuccess = false; // The failure of the AND chain carries forward
                continue; // Skip this command
            }
        }
        
        // --- Execution ---
        // If we passed the checks above, we are cleared to run.
        let result = await executePipeline(token.command);
        lastCommandSuccess = (result !== false);
        
        // Pass the separator of the command we just ran to the next token in the list.
        const nextTokenIndex = commandTokens.indexOf(token) + 1;
        if (commandTokens[nextTokenIndex]) {
            commandTokens[nextTokenIndex].previousSeparator = token.separator;
        }
    }
    
    // After the entire sequence is finished (or skipped), restore the prompt.
    if (!commanding) {
      done();
      print("");
    }
}

async function processCommand(input) {
  const displayInput = input.length > 200 ? input.substring(0, 200) + "..." : input;
  print(`${full_path} ${displayInput}`);

  if (input.startsWith(";")) {
    print("-start-terminal: syntax error near unexpected token `;'", "warning");
    done();
    return;
  }

  // --- NEW LOGIC for Pipe and Grep ---
  let commandToRun = input;
  activeGrepPattern = null; // Reset grep pattern for each new line

  if (input.includes('|')) {
    const parts = input.split('|').map(p => p.trim());
    const firstPart = parts[0];
    const restParts = parts.slice(1).join('|'); // Re-join in case of multiple pipes (future)

    if (restParts.startsWith('grep ')) {
      const grepPattern = restParts.substring(5).trim();
      if (grepPattern) {
        activeGrepPattern = new RegExp(grepPattern, 'i'); // Set the global pattern
        commandToRun = firstPart; // We will only run the command before the pipe
      }
    }
  }
  // --- END of new logic ---

  const commandList = commandToRun.split(";");
  awaiting();

  try {
    for (const singleCommand of commandList) {
      const trimmedCommand = singleCommand.trim();
      if (trimmedCommand) {
        let commandToExecute = trimmedCommand;
        const firstWord = trimmedCommand.split(' ')[0];
        if (aliases[firstWord]) {
          const aliasExpansion = aliases[firstWord];
          const restOfInput = trimmedCommand.substring(firstWord.length).trim();
          commandToExecute = `${aliasExpansion} ${restOfInput}`.trim();
          print(`> ${commandToExecute}`, "hint");
        }
        await proceedCommandCore(commandToExecute);
      }
    }
  } finally {
    // IMPORTANT: Ensure the grep pattern is always cleared after execution
    activeGrepPattern = null; 
    if (!commanding) {
      done();
    }
    print("");
  }
}

function awaiting() {
  typedText.innerHTML = "";
  // blockCursor.style.display = "none";
  promptSymbol.style.display = "none";
  blockCursor.classList.add('no-blink');  // Disable blinking while awaiting command completion
}

function done() {
  promptSymbol.style.display = "inline";
  // promptSymbol.textContent = full_path + " "; // update_user_path handles this or it's set on load
  update_user_path(); // Ensure prompt is fresh
  updateInputDisplay();
  // No need to explicitly focus body, focus should be managed to typedText
  if (!isComposing) { // Only focus if not in middle of IME
    typedText.focus();
    setCaretAtOffset(typedText, cursorPosition); // Ensure caret is correct after command
  }
  blockCursor.classList.remove('no-blink'); // Re-enable blinking
  window.scrollTo(0, document.body.scrollHeight);
}

// SETTINGS 
function saveDefaultSettings() {
  const settings = {
    default_search_engine: default_search_engine,
    default_mode: default_mode,
  };
  // chrome.storage.sync.set({ settings }); // Old
  setSetting('settings', settings); // New
}

function saveCommandHistory() {
  chrome.storage.sync.set({ commandHistory: previousCommands });
}

function saveCurrentPath() {
  // Save ID, ID is unique and can be used to retrieve the bookmark later
  const pathIds = path.map(node => node.id);
  chrome.storage.sync.set({ bookmarkPath: pathIds });
}

async function refreshMicrosoftToken(refreshToken) {
  print("Microsoft session token expired. Attempting to refresh...", "info");
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const params = new URLSearchParams();
  params.append('client_id', 'b4f5f8f9-d040-45a8-8b78-b7dd23524b92'); // 您的客户端ID
  params.append('scope', 'https://graph.microsoft.com/User.Read offline_access');
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const tokenInfo = await response.json();

    if (tokenInfo.error) {
      throw new Error(tokenInfo.error_description);
    }

    // 刷新成功，保存新的Token和用户信息
    const newExpirationTime = Date.now() + (tokenInfo.expires_in * 1000);
    // 从旧的存储中获取用户信息，因为刷新流程不返回这个
    const data = await chrome.storage.sync.get('msAuth');
    const msAuthData = {
      userInfo: data.msAuth.userInfo,
      tokenInfo: tokenInfo,
      expirationTime: newExpirationTime,
    };

    await chrome.storage.sync.set({ msAuth: msAuthData });
    print("Session refreshed successfully.", "success");
    return msAuthData;

  } catch (error) {
    print(`Session refresh failed: ${error.message}. Please log in again.`, "error");
    // 清除无效的登录信息
    await chrome.storage.sync.remove('msAuth');
    return null;
  }
}

function showPrivacyUpdateNotice() {
    print("Our Privacy Policy has been updated.", "highlight");
    // print("Please review the changes at: ")
    print(`Please review the changes at: ${PRIVACY_POLICY_URL}`, "info");
    print("Type 'privacy-ok' to dismiss this message.", "hint");
    print("");
}

// Load all settings 
// Old LoadSettings function, kept for reference
// TODO will be removed in the future
// async function loadSettings() {
//   // 1. Get the complete bookmark tree asynchronously
//   const bookmarkTree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
//   const trueRoot = bookmarkTree[0];
  
//   // --- FIX STARTS HERE ---
  
//   // Correctly assign the fetched bookmark tree to the global 'root' variable
//   root = trueRoot; 

//   // Set the home directory '~' to be the "Favorites bar"
//   if (trueRoot.children && trueRoot.children.length > 0) {
//     homeDirNode = trueRoot.children[0];
//   } else {
//     // Fallback: if there are no children, home is the same as the root.
//     homeDirNode = root; 
//   }

//   // Set the starting location to the home directory.
//   current = homeDirNode;
//   // The path must reflect the full hierarchy, starting from the now-defined 'root'.
//   path = [root, homeDirNode];

//   // --- FIX ENDS HERE ---

//   const data = await chrome.storage.sync.get(['settings', 'commandHistory', 'msAuth', 'bookmarkPath', 'theme', 'background_opacity', 'imgAPI', 'aliases', 'environmentVars', 'privacyPolicyVersion', 'cursorStyle']);
  
//   // 3. Restore bookmark path
//   if (data.bookmarkPath) {
//     let restoredPathIsValid = true;
//     let tempCurrent = root; // Start from the valid root
//     let tempPath = [root];

//     // Starting from the root, find each child by its ID to rebuild the path
//     for (let i = 1; i < data.bookmarkPath.length; i++) {
//       const nextId = data.bookmarkPath[i];
//       const nextNode = (tempCurrent.children || []).find(child => child.id === nextId);

//       if (nextNode && nextNode.children) { // Ensure the node still exists and is a folder
//         tempCurrent = nextNode;
//         tempPath.push(nextNode);
//       } else {
//         restoredPathIsValid = false; // If a folder in the path was deleted, restoration fails
//         break;
//       }
//     }

//     if (restoredPathIsValid) {
//       current = tempCurrent;
//       path = tempPath;
//     }
//   }

//   if (data.aliases) {
//     aliases = data.aliases;
//   }
    
//   if (data.settings) {
//     default_mode = data.settings.default_mode ?? false;
//     default_search_engine = data.settings.default_search_engine ?? "google";
//   }

//   if (data.commandHistory) {
//     previousCommands.push(...data.commandHistory);
//   }

//   if (data.environmentVars) {
//     environmentVars = data.environmentVars;
//   }

//   if (data.msAuth && data.msAuth.tokenInfo) {
//     let currentAuth = data.msAuth;
//     if (Date.now() > currentAuth.expirationTime) {
//       // Token has expired, try to refresh it
//       currentAuth = await refreshMicrosoftToken(currentAuth.tokenInfo.refresh_token);
//     }

//     if (currentAuth) {
//       const user_info = currentAuth.userInfo.userPrincipalName || currentAuth.userInfo.displayName;
//       user = user_info;
//       print(`Welcome back, ${user_info}`, "success");
//     }
//   }

//   if (data.privacyPolicyVersion !== PRIVACY_POLICY_VERSION) {
//     // If the privacy policy version does not match, show a notice
//     setTimeout(() => showPrivacyUpdateNotice(), 100);
//   }

//   const localData = await new Promise(resolve => chrome.storage.local.get('customBackground', resolve));
  
//   if (data.theme) {
//     promptTheme = data.theme;
//   }
  
//   if (data.imgAPI) {
//     promptBgRandomAPI = data.imgAPI;
//   }
//   if (localData.customBackground) {
//     promptOpacity = data.background_opacity;
//     applyTheme(data.theme);
//     applyBackground(localData.customBackground, data.background_opacity);
//   } else {
//     promptOpacity = data.background_opacity;
//     applyTheme(promptTheme);
//     applyBackground(null, promptOpacity); // Apply default background
//   }

//   //! Apply Cursor must be after applyTheme
//   if (data.cursorStyle) {
//     applyCursorStyle(data.cursorStyle);
//   } else {
//     applyCursorStyle('block'); // Apply default if nothing is saved
//   }

//   bgUploadInput.addEventListener('change', handleFileSelect);
// }


// script.js

/**
 * 根据一个设置对象生成 .startrc 文件的内容字符串。
 * @param {object} settings - 包含配置的对象 (e.g., { theme: 'ubuntu', aliases: {...} })
 * @returns {string} - 格式化后的 .startrc 文件内容。
 */
function generateStartrcContent(settings) {
  let content = "# Auto-generated .startrc from previous settings\n\n";

  // 处理主题
  if (settings.theme) {
    content += `# Set the visual theme.\n`;
    content += `theme ${settings.theme}\n\n`;
  }

  // 处理光标样式
  if (settings.cursorStyle) {
    content += `# Set the cursor style.\n`;
    content += `cursor ${settings.cursorStyle}\n\n`;
  }

  // 处理别名
  if (settings.aliases && Object.keys(settings.aliases).length > 0) {
    content += "# Command Aliases\n";
    for (const name in settings.aliases) {
      // 对包含空格的命令加引号
      const command = settings.aliases[name];
      content += `alias ${name}='${command}'\n`;
    }
    content += '\n';
  }

  // 处理环境变量
  if (settings.environmentVars && Object.keys(settings.environmentVars).length > 0) {
    content += "# Environment Variables\n";
    for (const key in settings.environmentVars) {
      const value = settings.environmentVars[key];
      // 对包含空格的值加引号
      content += `export ${key}="${value}"\n`;
    }
    content += '\n';
  }
  
  // 添加欢迎消息
  content += "# Welcome message\n";
  content += "welcome\n\n";

  content += "echo \"Settings imported. Welcome to the new .startrc mode!\"";
  return content;
}

// script.js

/**
 * 创建或更新 ~/.startrc 文件。
 * @param {string|null} content - 要写入文件的内容。如果为null，则使用默认内容。
 */
async function createOrUpdateStartrcFile(content = null) {
  let fileContent = content;
  if (fileContent === null) {
    // 默认配置
    fileContent = `
# Welcome to your .startrc file!
# This file is for configuring your terminal on startup.
# Lines starting with # or // are comments.

welcome

# Set the visual theme. Supported: default, ubuntu, powershell, cmd, kali, debian
theme ubuntu

# Set the cursor style. Supported: block, bar, underline
cursor bar

# Define command aliases. Use quotes for commands with spaces.
alias ll='ls -l -a'
alias g='google'

# Set environment variables. Quotes are optional for simple values.
export GREETING="Hello from .startrc!"
export EDITOR=nano

# You can also print messages on startup.
echo ".startrc loaded successfully."
    `.trim();
  }
  
  const existingRc = await findFileInHome('.startrc');
  if (existingRc) {
    await new Promise(resolve => chrome.bookmarks.remove(existingRc.id, resolve));
  }
  const dataUrl = `about:blank#${encodeURIComponent(fileContent)}`;
  await new Promise(resolve => chrome.bookmarks.create({ parentId: homeDirNode.id, title: '.startrc', url: dataUrl }, resolve));
}

/**
 * 解析并应用 .startrc 文件的配置。 (修复后版本)
 * @param {string} scriptContent - 从 .startrc 文件读取的配置内容。
 */
async function parseAndApplyStartrc(scriptContent) {
  const lines = scriptContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // --- 修复1: 同时支持 '#' 和 '//' 作为注释 ---
    if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      continue;
    }

    const tokens = trimmedLine.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const command = tokens.shift();
    const args = tokens; // args 现在是包含引号的完整参数

    switch (command) {
      case 'welcome':
        await commands.welcome.exec(); // 调用 welcome 命令
        break;

      case 'about':
        const options = {};
        const aboutArgs = [];
        args.forEach(arg => {
          if (arg.startsWith('-')) { // 简单处理 -v, -V 这样的选项
            for (const char of arg.substring(1)) options[char] = true;
          } else {
            aboutArgs.push(arg);
          }
        });
        commands.about.exec(aboutArgs, options); // 调用 about 命令
        break;

      case 'theme':
        const supportedThemes = ['default', 'ubuntu', 'powershell', 'cmd', 'kali', 'debian'];
        if (supportedThemes.includes(args[0])) {
          applyTheme(args[0]);
        } else {
          print(`[.startrc] Invalid theme: '${args[0]}'`, 'error');
        }
        break;
      
      case 'cursor':
        const supportedCursors = ['block', 'bar', 'underline'];
        if (supportedCursors.includes(args[0])) {
          applyCursorStyle(args[0]);
        } else {
          print(`[.startrc] Invalid cursor style: '${args[0]}'`, 'error');
        }
        break;

      // --- 修复2: 改进 alias 和 export 的解析逻辑 ---
      case 'alias':
      case 'export':
        const assignmentString = args.join(' ');
        const match = assignmentString.match(/^([^=]+)=(.*)$/);
        
        if (match) {
          const key = match[1];
          // 去除值部分两端的引号
          let value = match[2].trim().replace(/^['"]|['"]$/g, '');
          
          if (command === 'alias') {
            aliases[key] = value;
          } else {
            environmentVars[key] = value;
          }
        } else {
          print(`[.startrc] Invalid ${command} syntax: ${trimmedLine}`, 'error');
        }
        break;
      
      case 'echo':
        // 去除参数两端的引号后打印
        const echoMessage = args.map(arg => arg.replace(/^['"]|['"]$/g, '')).join(' ');
        print(echoMessage);
        break;

      default:
        print(`[.startrc] Unknown command: '${command}'`, 'error');
        break;
    }
  }
}

/**
 * 在主目录中查找一个文件（非文件夹）。
 * @param {string} fileName - 要查找的文件名。
 * @returns {object|null} 返回书签节点或 null。
 */
async function findFileInHome(fileName) {
    if (!homeDirNode || !homeDirNode.children) {
        const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
        if (tree && tree[0] && tree[0].children && tree[0].children[0]) {
            homeDirNode = tree[0].children[0];
        } else {
            return null;
        }
    }
    return (homeDirNode.children || []).find(child => child.title === fileName && !child.children);
}

async function loadSettings() {
  // 1. 获取完整的书签树
  const bookmarkTree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
  root = bookmarkTree[0];
  homeDirNode = (root.children && root.children.length > 0) ? root.children[0] : root;
  current = homeDirNode;
  path = [root, homeDirNode];

  // 2. 首先加载配置模式
  const configData = await new Promise(resolve => chrome.storage.sync.get(['configMode', 'autosyncEnabled'], resolve));
  configMode = configData.configMode || 'storage'; // 默认为 'storage'
  autosyncEnabled = configData.autosyncEnabled || false;

  // 3. 根据配置模式执行不同的加载逻辑
  if (configMode === 'startrc') {
    // --- .startrc 模式加载逻辑 ---
    const rcFile = await findFileInHome('.startrc');
    if (rcFile && rcFile.url) {
      try {
        const scriptContent = decodeURIComponent(rcFile.url.split('#')[1] || '');
        await parseAndApplyStartrc(scriptContent); // <<< 调用新的解析器
      } catch (e) {
        print(`Error reading .startrc file: ${e.message}`, 'error');
      }
    } else {
      print("Warning: .startrc file not found. Using default settings.", 'warning');
      print("Hint: Run 'config setup startrc' to create one.", 'hint');
    }
    // 在.startrc模式下，设置一个默认值以防脚本未配置
    applyTheme(promptTheme || 'default');
    applyCursorStyle(cursorStyle || 'block');

  } else {
    // --- 旧模式 (storage/bookmark) 的加载逻辑 ---
    aliases = await getSetting('aliases') || {};
    environmentVars = await getSetting('environmentVars') || {};
    promptTheme = await getSetting('theme') || 'default';
    const loadedSettings = await getSetting('settings');
    if (loadedSettings) {
      default_mode = loadedSettings.default_mode ?? false;
      default_search_engine = loadedSettings.default_search_engine ?? "google";
    }
    const loadedCursorStyle = await getSetting('cursorStyle');
    applyCursorStyle(loadedCursorStyle || 'block');
    applyTheme(promptTheme);
  }


  // 4. Load other non-routable settings directly from storage
  const data = await new Promise(resolve => chrome.storage.sync.get(['commandHistory', 'msAuth', 'bookmarkPath', 'background_opacity', 'imgAPI', 'privacyPolicyVersion'], resolve));
  
  if (data.commandHistory) {
    previousCommands.push(...data.commandHistory);
  }

  // 5. Restore last used bookmark path
  if (data.bookmarkPath) {
    let restoredPathIsValid = true;
    let tempCurrent = root;
    let tempPath = [root];
    for (let i = 1; i < data.bookmarkPath.length; i++) {
      const nextId = data.bookmarkPath[i];
      const nextNode = (tempCurrent.children || []).find(child => child.id === nextId);
      if (nextNode && nextNode.children) {
        tempCurrent = nextNode;
        tempPath.push(nextNode);
      } else {
        restoredPathIsValid = false;
        break;
      }
    }
    if (restoredPathIsValid) {
      current = tempCurrent;
      path = tempPath;
    }
  }

  // 6. Handle Microsoft Account session
  if (data.msAuth && data.msAuth.tokenInfo) {
    let currentAuth = data.msAuth;
    if (Date.now() > currentAuth.expirationTime) {
      currentAuth = await refreshMicrosoftToken(currentAuth.tokenInfo.refresh_token);
    }
    if (currentAuth) {
      user = currentAuth.userInfo.userPrincipalName || currentAuth.userInfo.displayName;
      print(`Welcome back, ${user}`, "success");
    }
  }
  
  // 7. Handle Privacy Policy check
  if (data.privacyPolicyVersion !== PRIVACY_POLICY_VERSION) {
    setTimeout(() => showPrivacyUpdateNotice(), 100);
  }

  // 8. Load and apply background settings
  const localData = await new Promise(resolve => chrome.storage.local.get('customBackground', resolve));
  applyTheme(promptTheme); // Apply theme loaded via getSetting
  
  if (data.imgAPI) promptBgRandomAPI = data.imgAPI;
  promptOpacity = data.background_opacity || 0.15;
  
  if (localData.customBackground) {
    applyBackground(localData.customBackground, promptOpacity);
  } else {
    applyBackground(null, promptOpacity); // Apply default background
  }

  bgUploadInput.addEventListener('change', handleFileSelect);
}


function clearOutput() {
  output.innerHTML = "";
  outputHistory = [];
  // Welcome message can be re-added if desired, or keep it minimal
  // welcomeMsg();
  // No need to reset buffer/cursor here as it's for visual output
  // Buffer clearing is handled by Enter key logic
  done(); // Redraw prompt and input display
}

function typingIO_cursor() {
  blockCursor.classList.add('no-blink');
  // after 2 seconds, re-enable blinking
  setTimeout(() => {
    blockCursor.classList.remove('no-blink');
  }, 100);
}

// in script.js, can be placed near other helper functions

function clearSuggestions() {
  suggestionsContainer.innerHTML = "";
  suggestionsContainer.style.display = "none";
}

// --- Keyboard Listeners ---
// --- Keyboard Listeners ---
document.body.addEventListener("keydown", async e => {

  if (isEditing) {
    // --- NANO MODE LOGIC ---
    if (activeEditor === 'nano') {
        // For nano, we only intercept our specific shortcuts.
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      editorStatus.textContent = "Saving...";
      
      const isStartrcFile = editingBookmarkTitle === '.startrc';
      const isSettingsFile = current.title === SETTINGS_FOLDER_NAME && CONFIG_KEYS.includes(editingBookmarkTitle);

      let updatePayload;

      // --- NANO .startrc 绿灯保存逻辑 ---
      if (isStartrcFile) {
        const content = document.getElementById('editor-textarea').value;
        const dataUrl = `about:blank#${encodeURIComponent(content)}`;
        updatePayload = { url: dataUrl }; // 只更新URL
      
      } else if (isSettingsFile) {
        const textarea = document.getElementById('editor-textarea');
        try {
            const parsedJson = JSON.parse(textarea.value);
            const stringifiedJson = JSON.stringify(parsedJson);
            const dataUrl = `about:blank#${encodeURIComponent(stringifiedJson)}`;
            updatePayload = { url: dataUrl };
        } catch (err) {
            editorStatus.textContent = `Error: Invalid JSON! ${err.message}`;
            return;
        }

      } else {
          // --- 原始保存逻辑 ---
          updatePayload = {
              title: editorTitleInput.value,
              url: editorUrlInput.value
          };
      }

      chrome.bookmarks.update(editingBookmarkId, updatePayload, (updatedNode) => {
          if (chrome.runtime.lastError) {
              editorStatus.textContent = `Error: ${chrome.runtime.lastError.message}`;
          } else {
              editorStatus.textContent = `Saved: ${updatedNode.title}`;
              unsavedChanges = false;
              if (updatePayload.title) editorTitleInput.value = updatePayload.title;
              editingBookmarkId = updatedNode.id;
              
              chrome.bookmarks.getSubTree(current.id, (results) => {
                  if (results && results[0]) current = results[0];
              });
          }
        });
    } else if (e.ctrlKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            exitEditor();
        }
        // For all other keys, we do NOT call preventDefault and do NOT return.
        // This allows the browser to handle typing and cursor movement normally.
        return;
    }

    // --- VIM MODE LOGIC ---
    if (activeEditor === 'vim') {
        const textarea = document.getElementById('editor-textarea');
        const commandLine = document.getElementById('editor-command-line');
        const commandLineInput = document.getElementById('editor-command-line-input');

        // -- INSERT MODE --
        if (vimMode === 'INSERT') {
            if (e.key === 'Escape') {
                e.preventDefault();
                vimMode = 'NORMAL';
                textarea.readOnly = true;
                document.getElementById('editor-footer').innerHTML = `<span>NORMAL MODE - Press 'i' to insert, ':' for commands</span>`;
                textarea.focus();
            }
            // For any other key in INSERT mode, we do nothing and let the browser handle it.
            // This allows typing, arrow keys, backspace, etc. to work naturally.
            return;
        }

        // For NORMAL and COMMAND mode, we control everything.
        e.preventDefault();

        // -- COMMAND MODE --
        if (vimMode === 'COMMAND') {
            if (e.key === 'Escape') {
                vimMode = 'NORMAL';
                commandLine.style.display = 'none';
                commandLineInput.textContent = '';
                textarea.focus();
                document.getElementById('editor-footer').innerHTML = `<span>NORMAL MODE - Press 'i' to insert, ':' for commands</span>`;
            } else if (e.key === 'Enter') {
                const command = commandLineInput.textContent.trim().substring(1);
                // (Your existing :w, :q, :wq, :q! logic is mostly correct and can be placed here)
                // Let's ensure the save logic is complete:
                if (command === 'w' || command === 'wq') {
                    editorStatus.textContent = "Saving...";
                    try {
                        const newData = JSON.parse(textarea.value);
                        const updatePayload = {
                            ...(newData.title !== undefined && { title: newData.title }),
                            ...(newData.url !== undefined && { url: newData.url })
                        };
                        chrome.bookmarks.update(editingBookmarkId, updatePayload, (node) => {
                            if (chrome.runtime.lastError) {
                                editorStatus.textContent = `Error: ${chrome.runtime.lastError.message}`;
                            } else {
                                editorStatus.textContent = `Saved: ${node.title}`;
                                unsavedChanges = false;
                                if (command === 'wq') exitEditor();
                            }
                        });
                    } catch (err) { editorStatus.textContent = `Error: Invalid JSON! ${err.message}`; }
                } else if (command === 'q') {
                    if (unsavedChanges) {
                        editorStatus.textContent = "Unsaved changes! Use ':q!' to discard.";
                    } else {
                        exitEditor();
                    }
                } else if (command === 'q!') {
                    unsavedChanges = false;
                    exitEditor();
                }
                // Exit command mode after execution
                if (command !== 'q' || !unsavedChanges) {
                    vimMode = 'NORMAL';
                    commandLine.style.display = 'none';
                    commandLineInput.textContent = '';
                    textarea.focus();
                    document.getElementById('editor-footer').innerHTML = `<span>NORMAL MODE - Press 'i' to insert, ':' for commands</span>`;
                }
            } else if (e.key === 'Backspace') {
                if (commandLineInput.textContent.length > 1) {
                    commandLineInput.textContent = commandLineInput.textContent.slice(0, -1);
                }
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                commandLineInput.textContent += e.key;
            }
            return;
        }

        // -- NORMAL MODE --
        if (vimMode === 'NORMAL') {
            if (e.key === 'i') {
                vimMode = 'INSERT';
                textarea.readOnly = false;
                document.getElementById('editor-footer').innerHTML = `<span style="background-color: #8ae234; color: #000;">-- INSERT --</span>`;
                setTimeout(() => textarea.focus(), 0);
            } else if (e.key === ':') {
                vimMode = 'COMMAND';
                commandLine.style.display = 'block';
                commandLineInput.textContent = ':';
                commandLineInput.focus();
                // Logic to set cursor to end
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(commandLineInput);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }
    return; 
  }


  // IO operations

  // Stop cusor blinking when typing

  // if user input mode 
  if (input_mode) {
    if (e.key === "Backspace") {
    e.preventDefault();
    if (cursorPosition > 0) {
      const charToDelete = buffer.substring(cursorPosition -1, cursorPosition);
      // Basic backspace, could be enhanced for ^H like behavior if needed
      buffer = buffer.substring(0, cursorPosition - 1) + buffer.substring(cursorPosition);
      cursorPosition--;
      typingIO_cursor();
      updateInputDisplay();
    }
  } else if (e.key === "Enter") {
    clearSuggestions(); 
    e.preventDefault();
    user_input_content = buffer;

  } else if (e.key.length === 1 && !control_cmd && !e.metaKey) { // Handles most printable characters
    clearSuggestions(); 
    e.preventDefault();
    typingIO_cursor();
    buffer = buffer.substring(0, cursorPosition) + e.key + buffer.substring(cursorPosition);
    cursorPosition++;
    updateInputDisplay();
  }
    return 
  }
  

  if (e.key === "Control") {
    control_cmd = true;
    return;
  }

  if (commanding) { // If a command is running
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        interrupt();
    }
    return; // Most keys ignored during command execution
  }
  
  // --- NEW EMACS-STYLE SHORTCUTS ---
  if (e.ctrlKey && !e.altKey && !e.shiftKey) {
    // console.log("Key pressed:", e.key);
      switch (e.key.toLowerCase()) {
          case 'a': // Move to beginning of line
              e.preventDefault();
              cursorPosition = 0;
              updateInputDisplay();
              return;
          case 'e': // Move to end of line
              e.preventDefault();
              cursorPosition = buffer.length;
              updateInputDisplay();
              return;
          case 'u': // Delete from cursor to start of line
              e.preventDefault();
              if (cursorPosition > 0) {
                  yankBuffer = buffer.substring(0, cursorPosition);
                  buffer = buffer.substring(cursorPosition);
                  cursorPosition = 0;
                  updateInputDisplay();
              }
              return;
          case 'k': // Delete from cursor to end of line
              e.preventDefault();
              yankBuffer = buffer.substring(cursorPosition);
              buffer = buffer.substring(0, cursorPosition);
              updateInputDisplay();
              return;
          case 'w': // Delete word before cursor
              e.preventDefault();
              if (cursorPosition > 0) {
                  const originalCursorPos = cursorPosition;
                  let endOfWord = cursorPosition;
                  while (endOfWord > 0 && buffer[endOfWord - 1] === ' ') {
                      endOfWord--;
                  }
                  let startOfWord = endOfWord;
                  while (startOfWord > 0 && buffer[startOfWord - 1] !== ' ') {
                      startOfWord--;
                  }
                  yankBuffer = buffer.substring(startOfWord, originalCursorPos);
                  buffer = buffer.substring(0, startOfWord) + buffer.substring(originalCursorPos);
                  cursorPosition = startOfWord;
                  updateInputDisplay();
              }
              return;
          case 'y': // Paste (yank)
              e.preventDefault();
              if (yankBuffer) {
                  buffer = buffer.substring(0, cursorPosition) + yankBuffer + buffer.substring(cursorPosition);
                  cursorPosition += yankBuffer.length;
                  updateInputDisplay();
              }
              return;

          case 'arrowleft':
              e.preventDefault();
              let prevWordPos = cursorPosition;
              if (prevWordPos > 0) {
                  while (prevWordPos > 0 && buffer[prevWordPos - 1] === ' ') prevWordPos--;
                  while (prevWordPos > 0 && buffer[prevWordPos - 1] !== ' ') prevWordPos--;
                  cursorPosition = prevWordPos;
                  updateInputDisplay();
              }
              return;

          case 'arrowright':
              e.preventDefault();
              let nextWordPos = cursorPosition;
              if (nextWordPos < buffer.length) {
                  while (nextWordPos < buffer.length && buffer[nextWordPos] !== ' ') nextWordPos++;
                  while (nextWordPos < buffer.length && buffer[nextWordPos] === ' ') nextWordPos++;
                  cursorPosition = nextWordPos;
                  updateInputDisplay();
              }
              return;
      }
  }

  if (e.altKey && !e.ctrlKey) {
      switch (e.key.toLowerCase()) {
          case 'b': // Move back one word
              e.preventDefault();
              let prevWordPos = cursorPosition;
              if (prevWordPos > 0) {
                  while (prevWordPos > 0 && buffer[prevWordPos - 1] === ' ') prevWordPos--;
                  while (prevWordPos > 0 && buffer[prevWordPos - 1] !== ' ') prevWordPos--;
                  cursorPosition = prevWordPos;
                  updateInputDisplay();
              }
              return;
          case 'f': // Move forward one word
              e.preventDefault();
              let nextWordPos = cursorPosition;
              if (nextWordPos < buffer.length) {
                  while (nextWordPos < buffer.length && buffer[nextWordPos] !== ' ') nextWordPos++;
                  while (nextWordPos < buffer.length && buffer[nextWordPos] === ' ') nextWordPos++;
                  cursorPosition = nextWordPos;
                  updateInputDisplay();
              }
              return;
      }
  }
  // --- END OF NEW SHORTCUTS ---

  // Arrow keys and their Ctrl equivalents
  if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === 'p')) {
    e.preventDefault();
    if (previousCommands.length > 0) {
      previousCommandIndex = Math.max(-previousCommands.length, previousCommandIndex - 1);
      buffer = previousCommands.at(previousCommandIndex) || "";
      cursorPosition = buffer.length;
      updateInputDisplay();
    }
    return;
  }
  if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === 'n')) {
    e.preventDefault();
    if (previousCommands.length > 0 && previousCommandIndex < 0) {
        previousCommandIndex = Math.min(0, previousCommandIndex + 1);
        buffer = (previousCommandIndex === 0) ? "" : (previousCommands.at(previousCommandIndex) || "");
    } else { 
        buffer = "";
    }
    cursorPosition = buffer.length;
    updateInputDisplay();
    return;
  }
  if (e.key === "ArrowLeft" || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
    clearSuggestions(); 
    if (!isComposing && cursorPosition > 0) {
      e.preventDefault();
      cursorPosition--;
      updateInputDisplay();
    }
    return;
  }
  if (e.key === "ArrowRight" || (e.ctrlKey && e.key.toLowerCase() === 'f')) {
    clearSuggestions(); 
    if (!isComposing && cursorPosition < buffer.length) {
      e.preventDefault();
      cursorPosition++;
      updateInputDisplay();
    }
    return;
  }

  // Copy: Ctrl + Shift + C or Cmd + Shift + C
  if ((e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    const selection = window.getSelection();
    const selectedText = selection.toString()
      .split('\n')
      .map(line => line.replace(/\s+$/, ''))
      .join('\n');
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
    }
    selection.removeAllRanges();
    return;
  }

  if (e.key.toLowerCase() === "c" && control_cmd) {
    e.preventDefault();
    if (buffer.length > 0) {
        buffer = "";
        cursorPosition = 0;
        print(`${full_path} ${typedText.textContent}^C`);
        updateInputDisplay();
    } else { 
        print(full_path);
    }
    return;
  }

  if (e.key.toLowerCase() === "d" && control_cmd) {
    e.preventDefault();
    logoutWithMicrosoft();
    return;
  }
  
  // --- FINAL FIX v5: Replace the entire 'if (e.key === "Tab")' block with this ---

if (e.key === "Tab") {
    e.preventDefault();
    clearSuggestions();

    const relevantInput = buffer.substring(0, cursorPosition);
    const parts = relevantInput.trimStart().split(/\s+/);
    const commandName = parts[0] || "";
    const isTypingFirstWord = parts.length === 1 && !relevantInput.endsWith(' ');

    // --- PRIORITY 1: Sub-command/Argument Completion ---
    // Check if we are typing arguments for a command that has a suggestion engine.
    if (!isTypingFirstWord) {
        const commandDef = commands[commandName];
        if (commandDef && typeof commandDef === 'object' && commandDef.suggestions) {
            const currentArgs = parts.slice(1);
            
            const suggestionResult = commandDef.suggestions(currentArgs);
            if (suggestionResult && suggestionResult.length > 0) {
                const argToComplete = currentArgs[currentArgs.length - 1] || "";
                const matches = suggestionResult.filter(s => s.toLowerCase().startsWith(argToComplete.toLowerCase()));

                if (matches.length === 1) {
                    currentArgs[currentArgs.length - 1] = matches[0];
                    const newText = commandName + " " + currentArgs.join(" ").trim() + " ";
                    buffer = newText;
                    cursorPosition = buffer.length;
                    updateInputDisplay();
                } else if (matches.length > 1) {
                    suggestionsContainer.textContent = matches.join("   ");
                    suggestionsContainer.style.display = "block";
                }
                return; // Sub-command handled, exit.
            }
        }
    }

    // --- PRIORITY 2 & 3: Path or Top-Level Command Completion ---
    // This section uses the logic from your trusted, working code as a base.
    const DIR_ONLY_COMMANDS = ["cd", "rmdir", "tree"];
    const FILE_ONLY_COMMANDS = ["cat", "editlink", "nano", "vim", "./"];
    const ALL_CONTEXT_COMMANDS = ["ls", "rm", "mv", "cp", "touch", "find"];
    
    let effectiveCommandType = "";
    if (commandName.startsWith('./') || commandName.startsWith('/') || commandName.startsWith('~/')) {
        effectiveCommandType = "./"; // Treat all path executions as file-consuming
    } else if ([...DIR_ONLY_COMMANDS, ...FILE_ONLY_COMMANDS, ...ALL_CONTEXT_COMMANDS].includes(commandName)) {
        effectiveCommandType = commandName;
    }

    // If we have a context for file completion, run it.
    if (effectiveCommandType) {
        let pathPrefix = "";
        let nameToComplete = "";
        
        let pathArgumentString;
        if (effectiveCommandType === "./") {
            pathArgumentString = relevantInput.substring(relevantInput.match(/^(.\/|\/|~\/)/)[0].length);
        } else {
            const commandEndIndex = relevantInput.indexOf(commandName) + commandName.length;
            pathArgumentString = relevantInput.substring(commandEndIndex).trimStart();
        }

        const lastSlashPos = pathArgumentString.lastIndexOf('/');
        if (lastSlashPos > -1) {
            pathPrefix = pathArgumentString.substring(0, lastSlashPos + 1);
            nameToComplete = pathArgumentString.substring(lastSlashPos + 1);
        } else {
            pathPrefix = "";
            nameToComplete = pathArgumentString;
        }
        
        let pathResult = findNodeByPath(pathPrefix || ".");
        if (!pathResult || !pathResult.node || !pathResult.node.children) return;
        const contextChildren = pathResult.node.children;
        
        const matches = contextChildren.filter(child => {
            const title = child.title || "";
            if (!title.toLowerCase().startsWith(nameToComplete.toLowerCase())) return false;
            const isDirectory = !!child.children;
            if (DIR_ONLY_COMMANDS.includes(effectiveCommandType)) return isDirectory;
            if (FILE_ONLY_COMMANDS.includes(effectiveCommandType)) return !isDirectory;
            return true;
        }).map(child => child.title).sort();
        
        if (matches.length === 1) {
            const match = matches[0];
            const isDir = !!(contextChildren.find(c => c.title === match)?.children);
            const completion = match + (isDir ? "/" : " ");
            const textBeforePath = relevantInput.substring(0, relevantInput.length - nameToComplete.length);
            buffer = textBeforePath + completion + buffer.substring(cursorPosition);
            cursorPosition = (textBeforePath + completion).length;
            updateInputDisplay();
        } else if (matches.length > 1) {
            suggestionsContainer.textContent = matches.map(m => (contextChildren.find(c => c.title === m)?.children ? m + "/" : m)).join("   ");
            suggestionsContainer.style.display = "block";
        }

    } else if (isTypingFirstWord) {
        // Fallback for first word if it's not a path or a file-op: complete from all commands/aliases
        const allCommandsAndAliases = [...Object.keys(commands), ...Object.keys(aliases)];
        const matches = allCommandsAndAliases.filter(c => c.toLowerCase().startsWith(commandName.toLowerCase()));

        if (matches.length === 1) {
            buffer = matches[0] + " " + buffer.substring(cursorPosition);
            cursorPosition = matches[0].length + 1;
            updateInputDisplay();
        } else if (matches.length > 1) {
            suggestionsContainer.textContent = matches.join("   ");
            suggestionsContainer.style.display = "block";
        }
    }
}

  if (isComposing) return;

  if (e.key === "Backspace") {
    clearSuggestions(); 
    e.preventDefault();
    if (cursorPosition > 0) {
      buffer = buffer.substring(0, cursorPosition - 1) + buffer.substring(cursorPosition);
      cursorPosition--;
      typingIO_cursor();
      updateInputDisplay();
    }
  } else if (e.key === "Enter") {
    clearSuggestions();
    e.preventDefault();
    if (commanding) return;

    const commandToProcess = buffer.trim();
    if (buffer.length > 0 && (!previousCommands.length || buffer !== previousCommands.at(-1))) {
        previousCommands.push(buffer);
        if (previousCommands.length > 50) previousCommands.shift();
        saveCommandHistory();
    }
    previousCommandIndex = 0;
    buffer = "";
    cursorPosition = 0;
    updateInputDisplay();

    executeLine(commandToProcess);
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    typingIO_cursor();
    buffer = buffer.substring(0, cursorPosition) + e.key + buffer.substring(cursorPosition);
    cursorPosition++;
    updateInputDisplay();
  }
});

// Helper to get children at a given path string relative to a starting directory node
function getChildrenAtPath(startDirNode, pathStr) {
    if (!pathStr) return startDirNode.children; // No path means current directory's children

    const segments = pathStr.split('/').filter(s => s.length > 0); // Filter out empty segments from "foo//bar"
    let currentDirNode = startDirNode;

    for (const segment of segments) {
        if (!currentDirNode || !currentDirNode.children) return null; // Invalid path segment if no children
        const foundNode = findChildByTitle(currentDirNode.children, segment); // findChildByTitle expects directories
        if (foundNode && foundNode.children) { // Must be a directory to continue path
            currentDirNode = foundNode;
        } else {
            return null; // Path invalid or segment not a directory
        }
    }
    return currentDirNode.children;
}

// script.js

// ... (after your findChildByTitleFileOrDir function is a good place) ...

/**
 * Recursively copies a bookmark node (file or folder).
 * @param {object} sourceNode - The bookmark node to copy.
 * @param {string} destParentId - The ID of the destination folder.
 * @param {string} [newName=null] - Optional new name for the copied node.
 */
async function copyNodeRecursively(sourceNode, destParentId, newName = null) {
  return new Promise((resolve, reject) => {
    // For a single bookmark (file)
    if (sourceNode.url) {
      chrome.bookmarks.create({
        parentId: destParentId,
        title: newName || sourceNode.title,
        url: sourceNode.url,
      }, resolve);
      return;
    }

    // For a folder
    chrome.bookmarks.create({
      parentId: destParentId,
      title: newName || sourceNode.title,
    }, (newFolder) => {
      if (!sourceNode.children || sourceNode.children.length === 0) {
        resolve(newFolder);
        return;
      }
      // Recursively copy all children
      const copyPromises = sourceNode.children.map(child =>
        copyNodeRecursively(child, newFolder.id)
      );
      Promise.all(copyPromises).then(() => resolve(newFolder)).catch(reject);
    });
  });
}

/**
 * Recursively finds files/folders matching a pattern.
 * @param {object} startNode - The bookmark node to start searching from.
 * @param {string} currentPath - The path string for the current node.
 * @param {RegExp} regex - The regular expression to match against the title.
 */
function findRecursive(node, currentPath, regex) {
  // Construct the relative path for the current node
  const newPath = (currentPath === '.' ? './' : currentPath + '/') + node.title;

  // Check if the current node's title matches the pattern
  if (regex.test(node.title)) {
    const className = node.children ? 'folder' : 'file';
    print(newPath, className);
  }

  // If it's a directory, recurse into its children
  if (node.children) {
    node.children.forEach(child => {
      findRecursive(child, newPath, regex);
    });
  }
}


// Handle paste
document.body.addEventListener('paste', (e) => {
    if (isComposing || commanding || promptSymbol.style.display === "none") {
        return;
    }
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    buffer = buffer.substring(0, cursorPosition) + text.replace(/\r?\n|\r/g, ' ') + buffer.substring(cursorPosition); // Replace newlines with spaces
    cursorPosition += text.length;
    updateInputDisplay();
});


// IME Composition Event Handlers
document.body.addEventListener('compositionstart', (e) => {
  if (commanding || promptSymbol.style.display === "none") return;
  isComposing = true;
  blockCursor.style.display = "none";
  
  // Ensure typedText is focused and caret is correctly positioned BEFORE IME starts.
  typedText.focus();
  // The innerHTML manipulation here helps clear any browser-held composition state visually.
  // It also prepares our .composing-text span if we decide to style via script (though currently not in compositionupdate).
  const textBefore = escapeHtml(buffer.substring(0, cursorPosition));
  const textAfter = escapeHtml(buffer.substring(cursorPosition));
  typedText.innerHTML = textBefore + `<span class="composing-text"></span>` + textAfter; // Empty span as placeholder
  
  setCaretAtOffset(typedText, cursorPosition); // Crucial for IME positioning
});

document.body.addEventListener('compositionupdate', (e) => {
  // e.preventDefault?.(); // This was in the original, keep if needed, but usually not for letting browser handle IME display
  if (commanding || promptSymbol.style.display === "none") return;
  if (!isComposing) return;
  // No longer setting typedText.innerHTML here to avoid duplicate input.
  // Browser's native IME will update the contenteditable #typedText.
  // If custom styling of composing text is needed, this is where it would be complex.
  // For now, rely on browser's default IME styling.
  // We might need to update our internal understanding of cursor if e.data changes selection.
  // However, `compositionend` is the primary source for final text.
});

document.body.addEventListener('compositionend', (e) => {
  if (commanding || promptSymbol.style.display === "none") return;
  if (!isComposing) return;

  isComposing = false;
  const composedText = e.data;

  // After composition, the contenteditable typedText contains the composed string + surrounding text.
  // We need to reconcile this with our buffer.
  // A simple way is to assume composedText replaces what was being composed at cursorPosition.
  if (composedText) {
    buffer = buffer.substring(0, cursorPosition) + composedText + buffer.substring(cursorPosition);
    cursorPosition += composedText.length;
  }
  // updateInputDisplay will now re-render based on the updated buffer and cursorPosition,
  // and it will also call setCaretAtOffset to ensure the final caret is correct.
  updateInputDisplay();
});


function interrupt() {
  if (commanding) {
    commanding = false; // Set flag to stop async loops like ping
    // Output for ^C is handled by the command itself or keydown handler
    print("^C", "warning");
    done(); // Restore prompt and input display
  }
}

document.body.addEventListener("keyup", e => {
  if (e.key === "Control" || e.key === "Meta") {
    control_cmd = false;
  }
});

function updateLinesOnResize() {
  updateCharacterWidth();
  const newLineWidth = output.clientWidth;
  const charWidth = CHARACTER_WIDTH;

  if (charWidth === 0) {
    return;
  }

  const lines = output.getElementsByClassName("output-line");
  for (let i = 0; i < lines.length; i++) {
    const lineDiv = lines[i];
    const rawText = lineDiv.getAttribute("data-raw-text");
    if (rawText === null) continue;

    const textStr = String(rawText);
    const totalTextPixelWidth = textStr.length * charWidth;
    let numSpaces = 0;

    if (totalTextPixelWidth < newLineWidth) {
      numSpaces = Math.floor((newLineWidth - totalTextPixelWidth) / charWidth);
    } else {
      const lastLineActualPixelWidth = totalTextPixelWidth % newLineWidth;
      if (lastLineActualPixelWidth === 0 && totalTextPixelWidth > 0) {
        numSpaces = 0;
      } else {
        numSpaces = Math.floor((newLineWidth - lastLineActualPixelWidth) / charWidth);
      }
    }
    numSpaces = Math.max(0, numSpaces);
    const filledText = " ".repeat(numSpaces);
    lineDiv.textContent = textStr + filledText;
  }
}

/**
 * Calculates the visual width of a string, treating CJK characters as width 2.
 * @param {string} text The string to measure.
 * @returns {number} The visual width of the string.
 */
function getVisualWidth(text) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        // A simple check for full-width characters.
        // This covers CJK unified ideographs, full-width forms, etc.
        if (charCode > 255) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
}

let resizeTimeout;
// window.addEventListener("resize", () => {
//   clearTimeout(resizeTimeout);
//   resizeTimeout = setTimeout(updateLinesOnResize, 150); // Debounce resize
// });
/**
/**
 * A debounce function to prevent resize events from firing too frequently.
 * @param {function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {function} The debounced function.
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Redraws the padding on all existing lines to fit the new terminal width.
 */
function redrawAllLinesOnResize() {
    updateCharacterWidth(); // Update our measurement of character width

    const currentHistory = [...outputHistory]; // Make a copy of the history
    output.innerHTML = ""; // Clear the screen
    outputHistory = []; // Reset the log

    // Replay the entire history, printing each line again with the new dimensions
    currentHistory.forEach(logEntry => {
        print(logEntry.text, logEntry.type, logEntry.allowHtml);
    });
}

// Attach the new, intelligent redraw function to the window's resize event.
window.addEventListener('resize', debounce(redrawAllLinesOnResize, 100));

window.onload = async () => {
  // No explicit body focus, let browser decide or user click.
  // typedText.focus() will be called by done() or click handler.
  updateCharacterWidth(); // Initial calculation
  await loadSettings(); // Load settings and user info
  // welcomeMsg();
  // updateInputDisplay(); // Called by done()
  done(); // Initial setup of prompt and input display
};

function detectBrowser() {
    var userAgent = navigator.userAgent;
    if (userAgent.includes("Firefox/")) return "Firefox";
    if (userAgent.includes("Edg/")) return "Edge"; // Edge before Chrome
    if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/") && !userAgent.includes("OPR/")) return "Chrome";
    if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) return "Safari";
    if (userAgent.includes("OPR/") || userAgent.includes("Opera")) return "Opera";
    return "Unknown browser";
}

function welcomeMsg() {
    const manifest = chrome.runtime.getManifest(); // 获取 manifest 数据
    print(`Terminal Startup v${manifest.version} - ${detectBrowser()}`);
    print("Author: Tian Yi, Bao");
    print("");
    print("Type 'help' for a list of commands.");
    print("Type 'about' for more information about start-terminal.");
    print("");
    print("Default Search Engine:");
    print(`  - Current: ${default_search_engine}`, "highlight");
    print(`  - Current default mode: ${default_mode ? "on" : "off"}`, `${default_mode ? "success" : "warning"}`);
    print("  - Supported: google, bing, baidu");
    print("  - Change with: default <search engine|on|off>", "hint");
    print("");
}

document.body.addEventListener("click", function(event) {
  // If the click is not on the input line or output, and no text is selected globally
  if (!inputLine.contains(event.target) && !output.contains(event.target) && !window.getSelection().toString()) {
      typedText.focus();
      // setCaretAtOffset(typedText, cursorPosition); // Ensure caret is at the logical position
  } else if (inputLine.contains(event.target) && !window.getSelection().toString()) {
      // If click is on input line (e.g. typedText itself) and no selection, ensure focus and caret
      typedText.focus();
      // Let browser handle caret placement on direct click if possible, or calculate from click event.
      // For simplicity, if they click typedText, it should gain focus. updateInputDisplay will handle caret.
  }
});

// Background and Theme 
function applyTheme(themeName) {
    document.body.className = `theme-${themeName}`;
    promptTheme = themeName;
    applyCursorStyle(cursorStyle); // Reapply cursor style to ensure it matches the theme
    saveTheme();
}

function applyCursorStyle(style) {
    document.body.classList.remove('cursor-style-block', 'cursor-style-bar', 'cursor-style-underline');
    document.body.classList.add(`cursor-style-${style}`);
    cursorStyle = style;
}

function saveTheme() {
  // chrome.storage.sync.set({ theme: promptTheme });
  setSetting('theme', promptTheme);
}

function saveEnvironmentVars() {
  // chrome.storage.sync.set({ environmentVars: environmentVars });
  setSetting('environmentVars', environmentVars);
}

function applyBackground(imageDataUrl, opacity) {
    if (imageDataUrl) {
        backgroundContainer.style.backgroundImage = `url(${imageDataUrl})`;
        backgroundContainer.style.opacity = opacity;
        promptOpacity = opacity;
    } else {
        // Apply default background or clear it
        // backgroundContainer.style.backgroundImage = `url('https://pic.re/image')`;
        // backgroundContainer.style.backgroundImage = `url('https://rpic.origz.com/api.php?category=pixiv')`;
        backgroundContainer.style.backgroundImage = `url('${promptBgRandomAPI}')`;
        backgroundContainer.style.opacity = promptOpacity;
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    console.log(file);
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageDataUrl = e.target.result;
            // 使用 chrome.storage.local，因为它有更大的存储空间 (5MB)
            if (imageDataUrl.length > 5 * 1024 * 1024) {
                print("Error: Image is too large (max 5MB).", "error");
                done();
                return;
            }
            chrome.storage.local.set({ customBackground: imageDataUrl }, () => {
                print("Background image uploaded successfully.", "success");
                print("Use 'setbg' to apply it.", "hint");
            });
        };
        reader.readAsDataURL(file);
    }
    done();
}

function checkForUpdates() {
  try {
    // 1. Check for update request 
    chrome.runtime.requestUpdateCheck((status, details) => {
      if (status === "update_available") {
        print(`Get: Update found (version ${details.version}).`, "success");
        print(``)
        // The update will be downloaded. The onUpdateAvailable listener will handle the next step.
      } else if (status === "no_update") {
        print(`Hit: ${details.version} found`, "info")
        console.log("No new update found."); //不在终端显示，保持整洁
      } else if (status === "throttled") {
        print("Update check is throttled. Please try again later.", "warning");
      }
      done();
      print("");
    });

  } catch (e) {
    // console.warn("Update check failed. This is expected if the extension is not installed from the store.", e);
    print(e, "error");
    print("Check Failed: This is expected if the extension is not installed from the store.", "error");
    done();
  }
  commanding = false;
}

async function applyUpdates() {
  let result = await userInputMode("Extension needs to be reloaded to update, reload now? [Y/n] ");
  print(`Extension needs to be reloaded to update, reload now? [Y/n] ${user_input_content}`)
  if (result) {
    chrome.runtime.onUpdateAvailable.addListener((details) => {
      print(`Fetched: ${details.version}`, 'info');
      chrome.runtime.reload();
    });
  } else {
    print("Abort")
  }
  done();
  commanding = false;

}

function userInputMode(query) {
  user_input_content = "";
  return new Promise((resolve) => {
    // 设置UI
    input_mode = true;
    awaiting();
    promptSymbol.style.display = "inline-block";
    promptSymbol.textContent = query;

    // 启动一个定时器来检查用户输入
    const intervalId = setInterval(() => {
      const current = user_input_content.trim().toLowerCase(); // 获取输入并规范化
      
      if (current === ""){
        
      }
      else if (current.toLowerCase() === "y") {
        clearInterval(intervalId); // 重要！停止定时器，防止内存泄漏
        input_mode = false;
        buffer = "";
        resolve(true); // 使用 resolve 来兑现承诺，并传递 true
      } else if (current.toLowerCase() === "n") {
        clearInterval(intervalId); // 重要！停止定时器
        input_mode = false;
        buffer = "";
        resolve(false); // 使用 resolve 来兑现承诺，并传递 false
      } else {
        clearInterval(intervalId); // 重要！停止定时器
        input_mode = false;
        buffer = "";
        resolve(false);
      }
    }, 100); // 100ms的间隔通常足够了，不必过于频繁
  });
}

const inputLine = document.getElementById("input-line"); // Cache for click listener

// Ping.js (provided by user, assumed to be at the end or imported)
// Ensure Ping class is available before ping_func is called.
var Ping = function(opt) { /* ... Ping class code ... */ };
Ping.prototype.ping = function(source, callback) { /* ... Ping.prototype.ping code ... */ };
if (typeof exports !== "undefined") { /* ... Ping module exports ... */ } else { window.Ping = Ping; }

var Ping = function(opt) {
    this.opt = opt || {};
    this.favicon = this.opt.favicon || "/favicon.ico";
    this.timeout = this.opt.timeout || 0;
    this.logError = this.opt.logError || false;
};

/**
 * Pings source and triggers a callback when completed.
 * @param {string} source Source of the website or server, including protocol and port.
 * @param {Function} callback Callback function to trigger when completed. Returns error and ping value.
 * @returns {Promise|undefined} A promise that both resolves and rejects to the ping value. Or undefined if the browser does not support Promise.
 */
Ping.prototype.ping = function(source, callback) {
    var promise, resolve, reject;
    if (typeof Promise !== "undefined") {
        promise = new Promise(function(_resolve, _reject) {
            resolve = _resolve;
            reject = _reject;
        });
    }

    var self = this;
    self.wasSuccess = false;
    self.img = new Image();
    self.img.onload = onload;
    self.img.onerror = onerror;

    var timer;
    var start = new Date();

    function onload(e) {
        self.wasSuccess = true;
        pingCheck.call(self, e);
    }

    function onerror(e) {
        self.wasSuccess = false;
        pingCheck.call(self, e);
    }

    if (self.timeout) {
        timer = setTimeout(function() {
            pingCheck.call(self, undefined);
    }, self.timeout); }


    /**
     * Times ping and triggers callback.
     */
    function pingCheck() {
        if (timer) { clearTimeout(timer); }
        var pong = new Date() - start;

        if (!callback) {
            if (promise) {
                return this.wasSuccess ? resolve(pong) : reject(pong);
            } else {
                throw new Error("Promise is not supported by your browser. Use callback instead.");
            }
        } else if (typeof callback === "function") {
            // When operating in timeout mode, the timeout callback doesn't pass [event] as e.
            // Notice [this] instead of [self], since .call() was used with context
            if (!this.wasSuccess) {
                if (self.logError) { console.error("error loading resource"); }
                if (promise) { reject(pong); }
                return callback("error", pong);
            }
            if (promise) { resolve(pong); }
            return callback(null, pong);
        } else {
            throw new Error("Callback is not a function.");
        }
    }

    self.img.src = source + self.favicon + "?" + (+new Date()); // Trigger image load with cache buster
    return promise;
};

if (typeof exports !== "undefined") {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = Ping;
    }
} else {
    window.Ping = Ping;
}