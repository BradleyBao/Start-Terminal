// script.js

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


let isEditing = false; 
let editingBookmarkId = null; 

let default_mode = false;
let default_search_engine = "google";

let aliases = {};

let user = ""

const BROWSER_TYPE = detectBrowser();
let current = null;
let root = null;
let path = [];

let full_path = null;

// chrome.bookmarks.getTree(bookmarkTree => {
//   get_fav(bookmarkTree);
// });

let promptTheme = "default"; // Default theme
let promptOpacity = .15; // Default opacity for the prompt
let promptBgRandomAPI = "https://rpic.origz.com/api.php?category=pixiv";

function get_fav(bookmarks) {
  root = bookmarks[0];
  current = root;
  path = [root];

  update_user_path();
};

function update_user_path() {
  full_path = user;
  if (user !== "") {
    full_path += ": ";
  }
  full_path += path.map(p => p.title || "~").join("/") || "/";
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
  "touch": "NAME\n  touch - create a new, empty bookmark\n\nSYNOPSIS\n  touch <filename>\n\nDESCRIPTION\n  Creates a new bookmark with the given <filename> and a blank URL. If a bookmark with the same name already exists, the command does nothing.",
  "man": "NAME\n  man - format and display the on-line manual pages\n\nSYNOPSIS\n  man <command>\n\nDESCRIPTION\n  Displays the manual page for a given command.",
  "clear": "NAME\n  clear, cls - clear the terminal screen\n\nSYNOPSIS\n  clear\n  cls\n\nDESCRIPTION\n  Clears all previous output from the terminal screen.",
  "editlink": "NAME\n  editlink - change the URL of a bookmark\n\nSYNOPSIS\n  editlink <bookmark_name> <new_url>\n\nDESCRIPTION\n  Sets a new URL for the specified bookmark in the current directory. This is useful for updating links for bookmarks created with 'touch'.",

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

// Function to update the input display (typedText and blockCursor)
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
    if (args.length === 0) return "Usage: yt <query> [-b]";
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
  clear: (args, options) => {
    clearOutput();
  },
  cls: (args, options) => {
    clearOutput();
  },
  ls: (args, options) => {
    listChildren(options);
  },
  cd: (args, options) => {
    if (!args) {
      return "Usage: cd <directory>"
    }
    changeDir(args);
  },
  pwd: (args, options) => {
    return path.map(p => p.title || "/home").join("/") || "/";
  },
  mkdir: (args) => {
    if (args.length === 0) {
      return "Usage: mkdir <directory_name>";
    }
    const dirName = args.join(" ");

    const existing = findChildByTitle(current.children || [], dirName);
    if (existing) {
      return `mkdir: cannot create directory '${dirName}': File exists`;
    }

    awaiting();
    chrome.bookmarks.create(
      {
        parentId: current.id,
        title: dirName,
      },
      (newFolder) => {
        if (chrome.runtime.lastError) {
          print(`Error creating directory: ${chrome.runtime.lastError.message}`, "error");
        } else {
          print(`Directory '${newFolder.title}' created.`);
          // 刷新当前节点的子节点列表以保持同步
          chrome.bookmarks.getSubTree(current.id, (results) => {
            if (results && results[0]) {
              current = results[0];
              path[path.length - 1] = current; // <-- THE FIX: Update the node in the path array
            }
            print("");
            done(); // <-- THE FIX: Call done() inside the async callback
          });
        }
      }
    );
  },
  // 在 script.js 中，替换旧的 rm 函数
rm: (args, options) => {
    if (args.length === 0) {
      return "Usage: rm [-r] [-f] <name>";
    }
    const targetName = args.join(" ");
    const target = findChildByTitleFileOrDir(current.children || [], targetName);

    if (!target) {
      if (options.f) return;
      return `rm: cannot remove '${targetName}': No such file or directory`;
    }

    const isDirectory = !!target.children;
    const isRecursive = !!options.r;

    if (isRecursive) {
      awaiting();
      chrome.bookmarks.removeTree(target.id, () => {
        if (chrome.runtime.lastError) {
          print(`Error removing '${targetName}': ${chrome.runtime.lastError.message}`, "error");
        } else {
          print(`Recursively removed '${targetName}'.`);
          chrome.bookmarks.getSubTree(current.id, (results) => {
            if (results && results[0]) {
              current = results[0];
              path[path.length - 1] = current; // <-- THE FIX
            }
            print("");
            done(); // <-- THE FIX
          });
        }
      });
      return;
    }

    if (isDirectory && target.children.length > 0) {
      return `rm: cannot remove '${targetName}': Is a directory. Use -r to remove recursively.`;
    }

    awaiting();
    chrome.bookmarks.remove(target.id, () => {
      if (chrome.runtime.lastError) {
        print(`Error removing '${targetName}': ${chrome.runtime.lastError.message}`, "error");
      } else {
        print(`Removed '${targetName}'.`);
        chrome.bookmarks.getSubTree(current.id, (results) => {
            if (results && results[0]) {
              current = results[0];
              path[path.length - 1] = current; // <-- THE FIX
            }
            print("");
            done(); // <-- THE FIX
          });
      }
    });
  },

rmdir: (args) => {
    if (args.length === 0) {
      return "Usage: rmdir <directory_name>";
    }
    const dirName = args.join(" ");
    const target = findChildByTitleFileOrDir(current.children || [], dirName);

    if (!target) {
      return `rmdir: failed to remove '${dirName}': No such directory`;
    }
    if (!target.children) {
      return `rmdir: failed to remove '${dirName}': Not a directory`;
    }
    if (target.children.length > 0) {
      return `rmdir: failed to remove '${dirName}': Directory not empty`;
    }

    awaiting();
    chrome.bookmarks.remove(target.id, () => {
      if (chrome.runtime.lastError) {
        print(`Error removing directory: ${chrome.runtime.lastError.message}`, "error");
      } else {
        print(`Removed directory '${dirName}'.`);
        chrome.bookmarks.getSubTree(current.id, (results) => {
            if (results && results[0]) {
              current = results[0];
              path[path.length - 1] = current; // <-- THE FIX
            }
            print("");
            done(); // <-- THE FIX
        });
      }
    });
  },
  // Theme 
  theme: (args, options) => {
    const supportedThemes = ['default', 'ubuntu', 'powershell', 'cmd', 'kali', 'debian'];
    const themeName = args[0];
    if (!themeName) {
        return `Current theme: ${promptTheme}. Supported: ${supportedThemes.join(', ')}.`;
    }
    if (supportedThemes.includes(themeName)) {
        applyTheme(themeName);
        chrome.storage.sync.set({ theme: themeName }); // 保存新设置
        return `Theme set to ${themeName}.`;
    } else {
        return `Error: Theme '${themeName}' not supported.`;
    }
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
  cat: (args, options) => {
    if (args.length === 0) {
      return "Usage: cat <bookmark_name>";
    }
    const targetName = args.join(" ");
    const target = findChildByTitleFileOrDir(current.children || [], targetName);

    if (!target) {
      return `cat: ${targetName}: No such file or directory`;
    }

    if (target.children) { // It's a directory
      return `cat: ${targetName}: Is a directory`;
    }

    // It's a bookmark, print its details
    print("--- Bookmark Details ---", "highlight");
    print(`Title:    ${target.title}`);
    print(`URL:      ${target.url}`);
    if (target.dateAdded) {
       print(`Added on: ${new Date(target.dateAdded).toLocaleString()}`);
    }
    print("----------------------", "highlight");
    return "";
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
      checkForUpdates();
    } else if (arg == "upgrade") {
      awaiting();
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
      checkForUpdates();
    } else if (arg == "upgrade") {
      awaiting();
      applyUpdates();
    }
  },
  history: () => {
    if (previousCommands.length === 0) {
      return "No history yet.";
    }
    previousCommands.forEach((cmd, index) => {
      // Right-align index for better readability
      const paddedIndex = String(index + 1).padStart(3, ' ');
      print(`${paddedIndex}  ${cmd}`);
    });
    return "";
  },

  // 在 script.js 中，替换旧的 touch 函数
touch: (args) => {
    if (args.length === 0) {
      return "Usage: touch <filename>";
    }
    const filename = args.join(" ");
    const existing = findChildByTitleFileOrDir(current.children || [], filename);

    if (existing) {
      return;
    }

    awaiting();
    chrome.bookmarks.create({
      parentId: current.id,
      title: filename,
      url: "about:blank#touched"
    }, (newItem) => {
      if (chrome.runtime.lastError) {
        print(`Error: ${chrome.runtime.lastError.message}`, "error");
        done();
      } else {
        chrome.bookmarks.getSubTree(current.id, (results) => {
          if (results && results[0]) {
            current = results[0];
            path[path.length - 1] = current; // <-- THE FIX
          }
          done(); // <-- THE FIX
        });
      }
    });
},
editlink: (args) => {
    if (args.length < 2) {
      return "Usage: editlink <bookmark_name> <new_url>";
    }
    // The first argument is the name, the rest is the URL
    const bookmarkName = args.shift(); 
    const newUrl = args.join(' ');

    const target = findChildByTitleFileOrDir(current.children || [], bookmarkName);

    if (!target) {
      return `editlink: '${bookmarkName}': No such file or bookmark.`;
    }
    if (target.children) {
      return `editlink: '${bookmarkName}': Is a directory, cannot set a URL.`;
    }

    awaiting();
    chrome.bookmarks.update(target.id, { url: newUrl }, (updatedNode) => {
      if (chrome.runtime.lastError) {
        print(`Error updating link: ${chrome.runtime.lastError.message}`, "error");
      } else {
        print(`Updated link for '${updatedNode.title}'.`);
        print(`New URL: ${updatedNode.url}`, "success");
      }
      
      // Refresh current directory to get the updated node data
      chrome.bookmarks.getSubTree(current.id, (results) => {
          if (results && results[0]) {
              current = results[0];
              path[path.length - 1] = current;
          }
          print("");
          done();
      });
    });
},

// 在 script.js 中，替换旧的 mv 函数
mv: (args) => {
    if (args.length < 2) {
      return "Usage: mv <source> <destination>";
    }
    const sourceName = args[0];
    const destName = args[1];
    const sourceNode = findChildByTitleFileOrDir(current.children || [], sourceName);
    if (!sourceNode) {
      return `mv: cannot stat '${sourceName}': No such file or directory`;
    }
    const destNode = findChildByTitleFileOrDir(current.children || [], destName);

    awaiting();
    const refreshAndDone = () => {
        chrome.bookmarks.getSubTree(current.id, (results) => {
            if (results && results[0]) {
                current = results[0];
                path[path.length - 1] = current; // <-- THE FIX
            }
            done(); // <-- THE FIX
        });
    };
    
    if (destNode && destNode.children) {
      chrome.bookmarks.move(sourceNode.id, { parentId: destNode.id }, (movedNode) => {
        if (chrome.runtime.lastError) print(`Error: ${chrome.runtime.lastError.message}`, "error");
        refreshAndDone();
      });
    } else {
      chrome.bookmarks.update(sourceNode.id, { title: destName }, (updatedNode) => {
        if (chrome.runtime.lastError) print(`Error: ${chrome.runtime.lastError.message}`, "error");
        refreshAndDone();
      });
    }
},

// 在 script.js 中，替换旧的 cp 函数
cp: async (args, options) => {
    if (args.length < 2) {
      return "Usage: cp [-r] <source> <destination>";
    }
    const sourceName = args[0];
    const destName = args[1];
    const sourceNode = findChildByTitleFileOrDir(current.children || [], sourceName);
    if (!sourceNode) {
      return `cp: cannot stat '${sourceName}': No such file or directory`;
    }
    if (sourceNode.children && !options.r) {
      return `cp: -r not specified; omitting directory '${sourceName}'`;
    }
    const destNode = findChildByTitleFileOrDir(current.children || [], destName);
    
    awaiting();
    try {
      if (destNode && destNode.children) {
        await copyNodeRecursively(sourceNode, destNode.id);
      } else {
        await copyNodeRecursively(sourceNode, current.id, destName);
      }
      
      const results = await new Promise(res => chrome.bookmarks.getSubTree(current.id, res));
      if (results && results[0]) {
          current = results[0];
          path[path.length - 1] = current; // <-- THE FIX
      }
    } catch (e) {
      print(`Error copying: ${e.message}`, "error");
    }
    done(); // <-- THE FIX (already well-placed in this async function)
},

  find: (args, options) => {
    if (args.length == 0) {
      return "Usage: find -name <pattern>";
    }
    const namePattern = args.join(" ");
    const regex = new RegExp(namePattern.replace(/\*/g, '.*'), 'i');

    print(`Searching for '${namePattern}'...`);
    awaiting();
    if (current.children) {
        // Start the search on each child of the current directory
        current.children.forEach(child => {
            findRecursive(child, '.', regex);
        });
    }
    done();
    return ""; // Signal command completion
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
      chrome.storage.sync.set({ aliases: aliases }); // Persist aliases
      return `Alias '${name}' set.`;
  },
  
  man: (args, options) => {
      if (args.length === 0) {
          return "What manual page do you want?";
      }
      const page = args[0];
      const content = manPages[page];

      if (!content) {
          return `No manual entry for ${page}`;
      }

      // Print with pre-wrap to respect newlines in the man page content
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
    if (args.length === 0) {
      return "Usage: nano <bookmark_name>";
    }
    const bookmarkName = args.join(' ');
    const target = findChildByTitleFileOrDir(current.children || [], bookmarkName);

    if (!target) {
      return `nano: '${bookmarkName}': No such file or bookmark.`;
    }
    if (target.children) {
      return `nano: '${bookmarkName}': Is a directory.`;
    }

    // Enter editing mode
    isEditing = true;
    editingBookmarkId = target.id;

    // Populate the editor fields
    editorTitleInput.value = target.title;
    editorUrlInput.value = target.url;
    editorStatus.textContent = `Editing: ${target.title}`;

    // Switch views
    terminal.style.display = "none";
    editorView.style.display = "flex";
    editorTitleInput.focus();
},
  help: () => {
    print("");
    print("--- Terminal Help ---", "highlight");
    print("");

    print("Search Commands", "highlight");
    print("  google <query> [-b]   - Search with Google.");
    print("  bing <query> [-b]     - Search with Bing.");
    print("  baidu <query> [-b]    - Search with Baidu.");
    print("  yt <query> [-b]       - Search with YouTube.");
    print("  bilibili <query> [-b] - Search with Bilibili.");
    print("  spotify <query> [-b]  - Search with Spotify.");
    print("");
    
    print("Navigation & Bookmarks", "highlight");
    print("  ls [-l]               - List bookmarks in current directory.");
    print("  cd <folder>           - Change directory to a bookmark folder.");
    print("  cd ..                 - Go to parent directory.");
    print("  pwd                   - Show current bookmark path.");
    print("  goto <url> [-b]       - Navigate to a specific URL.");
    print("  ./<bookmark_name>     - Open a bookmark in the current directory.");
    print("");

    print("File & Directory Operations", "highlight");
    print("  mkdir <folder>        - Create a new bookmark folder.");
    print("  touch <file>          - Create a new, empty bookmark.");
    print("  mv <src> <dest>       - Move or rename a bookmark/folder.");
    print("  cp [-r] <src> <dest>  - Copy a bookmark or folder.");
    print("  rm [-r] <name>        - Remove a bookmark or folder.");
    print("  rmdir <folder>        - Remove an empty bookmark folder.");
    print("  find [-name <pat>]    - Find bookmarks/folders by name.");
    print("  nano <file>           - Edit a bookmark.");
    print("  editlink <file>       - Update a bookmark's url.");

    print("");

    print("Account & System", "highlight");
    print("  mslogin               - Log in with a Microsoft account.");
    print("  mslogout              - Log out from Microsoft account.");
    print("  date                  - Show current date and time.");
    print("  clear (or cls)        - Clear the terminal screen.");
    print("  ping <host>           - Ping a host.");
    print("  locale                - Show browser language settings.");
    print("");
    
    print("Customization & History", "highlight");
    print("  theme <name>          - Change terminal theme.");
    print("  uploadbg / setbg      - Manage custom background.");
    print("  history               - Show command history.");
    print("  alias [name='cmd']    - Create or list command aliases.");
    print("  man <command>         - Show the manual page for a command.");
    print("");

    print("For more details on a command, type: man <command_name>", "hint");
    return ""; 
  },
};

// Alias 
commands.yt = commands.youtube;

function parseCommandLine(input) {
  const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(t => t.replace(/^"|"$/g, "")) || [];
  if (tokens.length === 0) return null;

  const command = tokens.shift();
  const args = [];
  const options = {};

  const optionRequiresValue = { // Define which options expect a value
      ping: ["n"],
      // Add other commands and their value-expecting options if any
  };
  const commandSpecificOptionValues = optionRequiresValue[command] || [];

  for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith("-")) {
          const optName = token.replace(/^-+/, "");
          if (commandSpecificOptionValues.includes(optName) && tokens[i+1] && !tokens[i+1].startsWith("-")) {
              options[optName] = tokens[i+1];
              i++; // Skip next token as it's the value
          } else {
              options[optName] = true;
          }
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


function print(text, type = "info") {
  const lineWidth = output.clientWidth;
  const charWidth = CHARACTER_WIDTH;

  if (charWidth === 0) {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'output-line output-line-powershell';
    lineDiv.setAttribute('data-raw-text', String(text));
    lineDiv.textContent = String(text);
    output.appendChild(lineDiv);
    window.scrollTo(0, document.body.scrollHeight);
    return;
  }

  const textStr = String(text);
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

  const lineDiv = document.createElement('div');
  lineDiv.className = `output-line output-line-powershell output-${type}`;
  lineDiv.setAttribute('data-raw-text', textStr);
  lineDiv.textContent = textStr + filledText;

  output.appendChild(lineDiv);
  window.scrollTo(0, document.body.scrollHeight);
}

function printLine(text, type = "info", endLine = false) {
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


function processCommand(input) {
  const displayInput = input.length > 200 ? input.substring(0, 200) + "..." : input;
  print(`${full_path} ${displayInput}`); // Echo command

  // --- ALIAS EXPANSION ---
  const firstWord = input.split(' ')[0];
  if (aliases[firstWord]) {
      const aliasExpansion = aliases[firstWord];
      const restOfInput = input.substring(firstWord.length).trim();
      input = `${aliasExpansion} ${restOfInput}`.trim();
      print(`> ${input}`, "hint"); // Show the expanded command
  }
  // --- END ALIAS EXPANSION ---


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
    if (typeof result === "string") {
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
  if (!commanding) { // If not an async command like ping
    print(""); // Add a blank line for spacing after most command outputs
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
}

// SETTINGS 
function saveDefaultSettings() {
  const settings = {
    default_search_engine: default_search_engine,
    default_mode: default_mode,
  };
  chrome.storage.sync.set({ settings });
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

// Load all settings 
async function loadSettings() {
  // 1. 异步获取完整的书签树
  const bookmarkTree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
  root = bookmarkTree[0];
  current = root; // 默认在根目录
  path = [root];  // 默认路径
  const data = await chrome.storage.sync.get(['settings', 'commandHistory', 'msAuth', 'bookmarkPath', 'theme', 'background_opacity', 'imgAPI', 'aliases']);
// 3. 恢复书签路径
  if (data.bookmarkPath) {
    let restoredPathIsValid = true;
    let tempCurrent = root;
    let tempPath = [root];

    // 从根目录开始，根据ID逐级向下查找，重建路径
    for (let i = 1; i < data.bookmarkPath.length; i++) {
      const nextId = data.bookmarkPath[i];
      const nextNode = (tempCurrent.children || []).find(child => child.id === nextId);

      if (nextNode && nextNode.children) { // 确保路径中的节点仍然存在且是文件夹
        tempCurrent = nextNode;
        tempPath.push(nextNode);
      } else {
        restoredPathIsValid = false; // 如果路径中某个文件夹被删了，则恢复失败
        break;
      }
    }

    if (restoredPathIsValid) {
      current = tempCurrent;
      path = tempPath;
    }
  }

  if (data.aliases) {
    aliases = data.aliases;
  }
    
  if (data.settings) {
    default_mode = data.settings.default_mode ?? false;
    default_search_engine = data.settings.default_search_engine ?? "google";
  }

  if (data.commandHistory) {
    previousCommands.push(...data.commandHistory);
  }

  if (data.msAuth && data.msAuth.tokenInfo) {
    let currentAuth = data.msAuth;
    if (Date.now() > currentAuth.expirationTime) {
      // Token 过期，尝试刷新
      currentAuth = await refreshMicrosoftToken(currentAuth.tokenInfo.refresh_token);
    }

    if (currentAuth) {
      const user_info = currentAuth.userInfo.userPrincipalName || currentAuth.userInfo.displayName;
      user = user_info;
      print(`Welcome back, ${user_info}`, "success");
    }
  }

  const localData = await new Promise(resolve => chrome.storage.local.get('customBackground', resolve));
  
  if (data.theme) {
    promptTheme = data.theme;
  }
  console.log(data.imgAPI);
  if (data.imgAPI) {
    promptBgRandomAPI = data.imgAPI;
    console.log("Background image API set to:", promptBgRandomAPI);
  }
  if (localData.customBackground) {
    // promptBg = localData.customBackground;
    promptOpacity = data.background_opacity;
    applyTheme(data.theme);
    applyBackground(localData.customBackground, data.background_opacity);
  } else {
    promptOpacity = data.background_opacity;
    applyTheme(promptTheme);
    applyBackground(null, promptOpacity); // Apply default background
  }

  bgUploadInput.addEventListener('change', handleFileSelect);
}


function clearOutput() {
  output.innerHTML = "";
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
document.body.addEventListener("keydown", e => {

  if (isEditing) {
    // Save: Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const newTitle = editorTitleInput.value;
      const newUrl = editorUrlInput.value;

      editorStatus.textContent = "Saving...";
      chrome.bookmarks.update(editingBookmarkId, { title: newTitle, url: newUrl }, (updatedNode) => {
        if (chrome.runtime.lastError) {
          editorStatus.textContent = `Error: ${chrome.runtime.lastError.message}`;
        } else {
          editorStatus.textContent = `Saved: ${updatedNode.title}`;
          // Refresh current directory silently in the background
          chrome.bookmarks.getSubTree(current.id, (results) => {
              if (results && results[0]) {
                current = results[0];
                path[path.length - 1] = current;
              }
          });
        }
      });
    }

    // Exit: Ctrl+X
    if (e.ctrlKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      // Exit editing mode
      isEditing = false;
      editingBookmarkId = null;

      // Switch views back
      editorView.style.display = "none";
      terminal.style.display = "block";
      done();
    }
    return; // Stop further processing in editing mode
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
    if (control_cmd && e.key.toLowerCase() === "c") {
        e.preventDefault();
        interrupt();
    } else if (e.key !== "Control" && e.key !== "Meta") { // Allow modifier keys
        // e.preventDefault(); // Optionally prevent other input during command execution
    }
    return; // Most keys ignored during command execution
  }


  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (previousCommands.length > 0) {
      if (previousCommandIndex === 0 && buffer.length > 0) {
          // If currently typing something new, save it as a draft before navigating history
          // This behavior can be refined. For now, simple history navigation.
      }
      previousCommandIndex = Math.max(-previousCommands.length, previousCommandIndex - 1);
      buffer = previousCommands.at(previousCommandIndex) || "";
      cursorPosition = buffer.length;
      updateInputDisplay();
    }
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (previousCommands.length > 0 && previousCommandIndex < 0) {
        previousCommandIndex = Math.min(0, previousCommandIndex + 1);
        if (previousCommandIndex === 0) {
            buffer = ""; // Or restore a draft if implemented
        } else {
            buffer = previousCommands.at(previousCommandIndex) || "";
        }
    } else { // At the "bottom" of history (or no history), clear buffer
        buffer = "";
    }
    cursorPosition = buffer.length;
    updateInputDisplay();
    return;
  }
  if (e.key === "ArrowLeft") {
    clearSuggestions(); 
    if (!isComposing && cursorPosition > 0) {
      e.preventDefault();
      cursorPosition--;
      updateInputDisplay();
    } // Allow default if composing for IME navigation
    return;
  }
  if (e.key === "ArrowRight") {
    clearSuggestions(); 
    if (!isComposing && cursorPosition < buffer.length) {
      e.preventDefault();
      cursorPosition++;
      updateInputDisplay();
    } // Allow default if composing
    return;
  }

  // Copy: Ctrl + Shift + C or Cmd + Shift + C
  if ((e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    // Get Selected Text
    const selection = window.getSelection();
    // remove white spaces after last non-space character and before \n), not only the space of the last line, but every line
    const selectedText = selection.toString()
      .split('\n')
      .map(line => line.replace(/\s+$/, ''))
      .join('\n');
    if (selectedText) {
      navigator.clipboard.writeText(selectedText).then(() => {
        // print("Copied to clipboard: " + selectedText, "success");
      }).catch(err => {
        // print("Failed to copy: " + err, "error");
      });
    } else {
      // print("Nothing selected to copy.", "warning");
    }

    // Unselect text after copying
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
    } else { // If buffer is empty, print prompt again (classic ^C behavior)
        print(full_path); // Just print the prompt
    }
    return;
  }

  if (e.key.toLowerCase() === "d" && control_cmd) {
    e.preventDefault();
    logoutWithMicrosoft();
    return;
  }
  
  if (e.key === "Tab") {
    e.preventDefault();
    clearSuggestions();

    // --- FIX: Define command categories for smarter filtering ---
    const DIR_ONLY_COMMANDS = ["cd", "rmdir"];
    // For file-only commands, we add a special "./" type for executable bookmarks
    const FILE_ONLY_COMMANDS = ["cat", "editlink", "nano", "./"];
    // Commands not in these lists (like ls, rm, mv, cp) will show both files and directories.

    const relevantInput = buffer.substring(0, cursorPosition);
    const pre_parts = relevantInput.trimStart().split(/\s+/);
    let commandName = pre_parts[0] || "";

    let prefixPath = "";
    let namePrefixToComplete = "";
    let currentContextChildren = current.children;
    let effectiveCommandType = "";
    let startOfBaseArgumentStringInRelevantInput = 0;

    const allCompletableCommands = [
        ...DIR_ONLY_COMMANDS, 
        ...FILE_ONLY_COMMANDS, 
        "ls", "rm", "mv", "cp", "touch" // Manually add universal commands
    ];

    if (commandName.startsWith("./")) {
        effectiveCommandType = "./"; // Use the special type we defined
        startOfBaseArgumentStringInRelevantInput = relevantInput.indexOf("./") + "./".length;
    } else if (allCompletableCommands.includes(commandName)) {
        effectiveCommandType = commandName;
        startOfBaseArgumentStringInRelevantInput = relevantInput.indexOf(commandName) + commandName.length + 1;
    } else {
        return;
    }

    let baseArgumentString = relevantInput.substring(startOfBaseArgumentStringInRelevantInput);
    if (!baseArgumentString && relevantInput.endsWith(" ")) {
        namePrefixToComplete = "";
        prefixPath = "";
    } else {
        const lastSlashPos = baseArgumentString.lastIndexOf('/');
        if (lastSlashPos > -1) {
            prefixPath = baseArgumentString.substring(0, lastSlashPos + 1);
            namePrefixToComplete = baseArgumentString.substring(lastSlashPos + 1);
        } else {
            prefixPath = "";
            namePrefixToComplete = baseArgumentString;
        }
    }
    
    currentContextChildren = getChildrenAtPath(current, prefixPath.endsWith('/') ? prefixPath.slice(0, -1) : prefixPath);
    if (!currentContextChildren) currentContextChildren = [];

    let matches = currentContextChildren
        .filter(child => {
            const title = child.title || "";
            if (!title.toLowerCase().startsWith(namePrefixToComplete.toLowerCase())) return false;

            // --- FIX: New, smarter filtering logic based on command type ---
            const isDirectory = !!child.children;

            if (DIR_ONLY_COMMANDS.includes(effectiveCommandType)) {
                return isDirectory; // Must be a directory
            }
            if (FILE_ONLY_COMMANDS.includes(effectiveCommandType)) {
                return !isDirectory; // Must be a file
            }

            // Default case for commands like ls, rm, mv, cp: show everything
            return true;
        })
        .map(child => child.title)
        .sort();
    
    // The rest of the logic for displaying matches remains the same...
    if (matches.length === 1) {
        const match = matches[0];
        const completion = match + " ";

        const replaceFrom = startOfBaseArgumentStringInRelevantInput;
        const newBuffer = buffer.substring(0, replaceFrom) + prefixPath + completion + buffer.substring(cursorPosition);
        
        buffer = newBuffer;
        cursorPosition = replaceFrom + prefixPath.length + completion.length;
        updateInputDisplay();

    } else if (matches.length > 1) {
        let commonPrefix = matches[0];
        for (let i = 1; i < matches.length; i++) {
            while (!matches[i].toLowerCase().startsWith(commonPrefix.toLowerCase())) {
                commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
            }
        }

        if (commonPrefix.length > namePrefixToComplete.length) {
            const replaceFrom = startOfBaseArgumentStringInRelevantInput;
            const newBuffer = buffer.substring(0, replaceFrom) + prefixPath + commonPrefix + buffer.substring(cursorPosition);
            
            buffer = newBuffer;
            cursorPosition = replaceFrom + prefixPath.length + commonPrefix.length;
            updateInputDisplay();
        }
        
        let outputLineContent = "";
        matches.forEach(m => {
             const matchedNode = currentContextChildren.find(c => c.title === m);
             outputLineContent += (matchedNode && matchedNode.children ? m + "/" : m) + "   ";
        });
        
        suggestionsContainer.textContent = outputLineContent.trim();
        suggestionsContainer.style.display = "block";
    }
    return;
}


  if (control_cmd || e.metaKey || e.altKey) {
    if ((control_cmd || e.metaKey) && e.key.toLowerCase() === 'v') {
        // Paste handled by event listener
    } else if ((control_cmd || e.metaKey) && e.key.toLowerCase() === 'c' && window.getSelection().toString().length > 0) {
        // Allow native copy if text is selected
    } else {
       // return; // Let other Ctrl/Meta/Alt shortcuts behave normally or be ignored
    }
  }

  if (isComposing) return;

  if (e.key === "Backspace") {
    clearSuggestions(); 
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
    if (promptSymbol.style.display === "none" && commanding) return;

    const commandToProcess = buffer.trim();
    if (buffer.length > 0 && (!previousCommands.length || buffer !== previousCommands.at(-1))) {
         previousCommands.push(buffer);
         if (previousCommands.length > 50) previousCommands.shift(); // Limit history size
         saveCommandHistory(); // Save command history to storage
    }
    previousCommandIndex = 0; // Reset history index

    if (commandToProcess === "") {
      print(`${full_path} ${buffer}`);
      // print(""); // Blank line after empty command
    } else {
      processCommand(commandToProcess); // processCommand now adds its own blank line
    }
    buffer = "";
    cursorPosition = 0;
    if (!commanding) {
        updateInputDisplay(); // Update display unless an async command took over
    }

  } else if (e.key.length === 1 && !control_cmd && !e.metaKey) { // Handles most printable characters
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


let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(updateLinesOnResize, 150); // Debounce resize
});

window.onload = async () => {
  // No explicit body focus, let browser decide or user click.
  // typedText.focus() will be called by done() or click handler.
  updateCharacterWidth(); // Initial calculation
  await loadSettings(); // Load settings and user info
  welcomeMsg();
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
    saveTheme();
}

function saveTheme() {
  chrome.storage.sync.set({ theme: promptTheme });
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
}

async function applyUpdates() {
  let result = await userInputMode("Extension needs to be reloaded to update, reload now? [Y|n] ");
  print(`Extension needs to be reloaded to update, reload now? [Y|n] ${user_input_content}`)
  if (result) {
    chrome.runtime.onUpdateAvailable.addListener((details) => {
      print(`Fetched: ${details.version}`, 'info');
      chrome.runtime.reload();
    });
  } else {
    print("Abort")
  }
  done();
  

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