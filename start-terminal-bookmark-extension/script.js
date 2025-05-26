// script.js

const output = document.getElementById("output");
const typedText = document.getElementById("typedText"); // This will show text before cursor OR full text with highlighted char
const blockCursor = document.querySelector(".typed-container .cursor"); // The '█'
const terminal = document.getElementById("terminal");
const promptSymbol = document.getElementById("promptSymbol");
const supported_search_engine = ["google", "bing", "baidu"];

var control_cmd = false;
var commanding = false;
let buffer = "";
let cursorPosition = 0; // Tracks the cursor position within the buffer
let isComposing = false; // For IME input 
let default_mode = false; 
let default_search_engine = "google"; 

let user = ""

const BROWSER_TYPE = detectBrowser();
let current = null;
let root = null;
let path = []; 

let full_path = null;

chrome.identity.getProfileUserInfo(userInfo => {
  // userInfo.email 
  user = userInfo.email;
});

chrome.bookmarks.getTree(bookmarkTree => {
  get_fav(bookmarkTree);
});

function get_fav(bookmarks) {
  root = bookmarks[0];
  current = root;
  path = [root];
  
  update_user_path();
};

function update_user_path() {
  full_path = user;
  if (user !== "") {
    full_path += " ";
  }
  full_path += path.map(p => p.title || "~").join("/") || "/";
  full_path +=  " $";
  promptSymbol.textContent = full_path;
}

function listChildren() {
  if (!current.children) {
    print("Not a directory") 
    return ""
  }

  let printout = "";

  current.children.forEach((child, index) => {
    if (child.children) {
      printLine(`${child.title}`, "folder")
    } else {
      printLine(`${child.title}`, "file")
    }
    
  })
}

const previousCommands = [];
let previousCommandIndex = 0;

// Function to escape HTML special characters
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Function to update the input display (typedText and blockCursor)
function updateInputDisplay() {
  if (isComposing) {
    // During composition, blockCursor is generally hidden or IME handles cursor
    // The compositionupdate handler will manage typedText.innerHTML
    blockCursor.style.display = "none";
    return;
  }

  if (cursorPosition === buffer.length) {
    typedText.textContent = buffer;
    blockCursor.style.display = "inline-block"; // Show block cursor at the end
  } else {
    // Show highlighted char as cursor
    const charAtCursor = buffer[cursorPosition] || ' '; // Use space if char is undefined (should not happen with correct logic)
    typedText.innerHTML =
      escapeHtml(buffer.substring(0, cursorPosition)) +
      `<span class="highlighted-char">${escapeHtml(charAtCursor)}</span>` +
      escapeHtml(buffer.substring(cursorPosition + 1));
    blockCursor.style.display = "none"; // Hide block cursor when internal cursor is shown
  }
}


// Function to measure character width
function getMonospaceCharacterWidth() {
    const span = document.createElement('span');
    span.textContent = ' ';
    span.style.fontFamily = 'Consolas, monospace';
    span.style.fontSize = '16px';
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    
    const parentElement = document.getElementById("output") || document.body;
    parentElement.appendChild(span);
    const width = span.getBoundingClientRect().width;
    parentElement.removeChild(span);
    
    return width > 0 ? width : 8;
}

let CHARACTER_WIDTH = getMonospaceCharacterWidth();

function updateCharacterWidth() {
    CHARACTER_WIDTH = getMonospaceCharacterWidth();
}

function changeDir(name) {
  name = name[0];
  if (name === "..") {
    if (path.length > 1) {
      path.pop();
      current = path[path.length - 1];
    } else {
      
    }
    update_user_path();
    return;
  }

  let index_path = path.map(p => p.title || "/home").join("/") || "/";

  const target = findChildByTitle(current.children || [], name);
  if (target) {
    current = target;
    path.push(current);
  } else {
    print(`cd: Cannot find the path ${index_path}/${name}.`, "error"); 
  }

  update_user_path();
  buffer = "";
  cursorPosition = 0;
  updateInputDisplay(); // Clears visual input line
}

function findChildByTitle(children, title) {
  return children.find(child => child.title === title && child.children);
}

function findChildByTitleFile(children, title) {
  return children.find(child => child.title === title && !child.children);

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
    awating();
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
  ls: (args, options) => {
    listChildren();
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
  gh: () => location.href = "https://github.com",
  default: (args, options) => {
    // Change the default search engine
    if (args.length === 0) return "Usage: default <search engine> (google, bing, baidu)";
    let arg = args[0];
    if (arg == "on") {
      default_mode = true;
      print("Default mode is on. ");
      print("To turn it off, type 'default off'");
    } else if (arg == "off") {
      default_mode = false;
      print("Default mode is off. ");
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
    
  },
  help: () => {
    print("Commands Available:");
    print(" - google <query> [-b]: Search Google.");
    print(" - youtube <query> [-b]: Search YouTube (aliased as 'yt')."); // Added alias info
    print(" - bing <query> [-b]: Search Bing.");
    print(" - baidu <query> [-b]: Search Baidu.");
    print(" - bilibili <query> [-b]: Search Bilibili.");
    print(" - spotify <query> [-b]: Search Spotify.");
    print(" - ping <host> [-t] [-n <count>]: Ping a host.");
    print(" - goto <url> [-b]: Navigate to URL.");
    print(" - date: Show current date and time.");
    print(" - clear: Clear terminal output.");
    print(" - gh: Navigate to GitHub.");
    print(" - help: Show this help message.");
    print("\nOptions:");
    print("  -b: Open search results or URL in a new tab.");
    print("  -t: (ping) Ping continuously.");
    print("  -n <count>: (ping) Number of pings.");
    print("\nNavigation:");
    print("  ArrowUp/ArrowDown: Cycle through command history.");
    print("  ArrowLeft/ArrowRight: Move cursor in the current command line.");
    print("  Ctrl+C: Interrupt running command or clear current input line.");
    return " ";
  }
};

commands.yt = commands.youtube; // Alias for youtube

function parseCommandLine(input) {
  const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(t => t.replace(/^"|"$/g, ""));
  if (!tokens || tokens.length === 0) return null;

  const command = tokens.shift();
  const args = [];
  const options = {};

  const optionRequiresValue = {
    ping: ["n"],
    google: [], 
    yt: [],
    youtube: [],
    bing: [],
    baidu: [],
    bilibili: [],
    spotify: [],
    goto: []
  };

  const requiresValue = optionRequiresValue[command] || [];

  while (tokens.length > 0) {
    const token = tokens.shift();
    if (token.startsWith("-")) {
      const name = token.replace(/^-+/, '');
      const expectsValue = requiresValue.includes(name);
      const next = tokens[0];

      if (expectsValue && next && !next.startsWith("-")) {
        options[name] = tokens.shift();
      } else {
        options[name] = true;
      }
    } else {
      args.push(token);
    }
  }
  return { command, args, options };
}

async function ping_func(url, options) {
  print(""); 
  // Check if the URL has http or https protocol
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`; // 默认使用 http 协议
  }

  // Command running 
  commanding = true;

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
        if (error) {
          console.error(`Failed to ping ${url}:`, error);
          print(`Failed to ping ${url}: ${error}`, "error");
          commanding = false; // Reset command running state
          done(); // Restore prompt
          return;
        }
      }
      );
      const latency = Date.now() - start;
      print(`Reply from ${url}: ${latency} ms`);
      // Sleep for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    }
    
  } catch (error) {
    console.error(`Failed to ping ${url}:`, error);
  }
  // Reset command running state
  commanding = false;
  print("");
  done();
}

function print_inline(text, type = "info") {
  const lineWidth = output.clientWidth;
  const charWidth = CHARACTER_WIDTH;

  const textStr = String(text);
  const totalTextPixelWidth = textStr.length * charWidth;
  let numSpaces = 0;

  if (charWidth === 0) {
    // fallback: just append new inline span
    const span = document.createElement('span');
    span.className = `output-inline output-${type}`;
    span.textContent = textStr;
    output.appendChild(span);
    window.scrollTo(0, document.body.scrollHeight);
    return;
  }

  // 计算补齐空格数（用于对齐）
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

  // 尝试获取最后一行
  let lastLine = output.lastElementChild;

  // 如果没有最后一行或最后一行不是 inline 输出，就新建一行
  if (!lastLine || !lastLine.classList.contains("output-line-inline")) {
    lastLine = document.createElement("div");
    lastLine.className = `output-line output-line-inline output-${type}`;
    output.appendChild(lastLine);
  }

  // 追加 inline span 到当前行
  const span = document.createElement("span");
  span.className = `output-inline output-${type}`;
  span.textContent = textStr + filledText;
  lastLine.appendChild(span);

  window.scrollTo(0, document.body.scrollHeight);
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

function printLine(text, type = "info") {
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
  // const totalTextPixelWidth = textStr.length * charWidth;
  // let numSpaces = 0;

  // if (totalTextPixelWidth < lineWidth) {
  //   numSpaces = Math.floor((lineWidth - totalTextPixelWidth) / charWidth);
  // } else {
  //   const lastLineActualPixelWidth = totalTextPixelWidth % lineWidth;
  //   if (lastLineActualPixelWidth === 0 && totalTextPixelWidth > 0) {
  //     numSpaces = 0;
  //   } else {
  //     numSpaces = Math.floor((lineWidth - lastLineActualPixelWidth) / charWidth);
  //   }
  // }
  
  // numSpaces = Math.max(0, numSpaces);
  // const filledText = " ".repeat(numSpaces);

  const lineDiv = document.createElement('div');
  lineDiv.className = `output-line-inline output-line-powershell output-${type}`;
  lineDiv.setAttribute('data-raw-text', textStr);
  lineDiv.textContent = textStr + "\t";

  output.appendChild(lineDiv);
  window.scrollTo(0, document.body.scrollHeight);
}

function processCommand(input) {
  print(`${full_path} ${input}`); // Echo command with padding
  const parsed = parseCommandLine(input);
  if (!parsed) {
      print("Invalid command syntax."); // Provide more specific feedback
      return;
  }

  // If start with ./
  if (input.startsWith("./")) {
    let name = input.substring(2).trim();
    // Get the target child 
    const target = findChildByTitleFile(current.children || [], name);
    if (target) {
      // If target is a file, open it
      if (target.url) {
        if (target.url.startsWith("javascript:")) {
          print(`Executing JavaScript code from ${target.title} is not allowed for security reasons.`, "error");
          return;
        }
        location.href = target.url; // Navigate to the URL
      }
    }
    return;
  }

  const { command, args, options } = parsed;
  const action = commands[command];
  
  if (action) {
    const result = action(args, options);
    if (typeof result === "string") {
        print(result);
    } else if (typeof result === "boolean" && result === true) {
      // For commands that navigate or start async ops handled by awating()
      // awating(); // awating() should be called by async commands like ping
    } else if (typeof result === "boolean" && result === false) {
      print(`Command '${command}' failed execute or returned false.`);
    }
    // If action is async (like ping), it should handle its own "done" state.
  } else {
    if (default_mode) {
      const fix_action = commands[default_search_engine] 
      args.unshift(command);
      const fix_result = fix_action(args, options);
      return; 
    }
    
    print(`Unknown command: '${command}' (try 'help')`, "error");
    print("");
  }
}

function awating() {
  typedText.innerHTML = ""; // Clear input area
  blockCursor.style.display = "none"; // Hide block cursor
  promptSymbol.style.display = "none";
}

function done() {
  promptSymbol.style.display = "inline";
  promptSymbol.textContent = full_path + " ";
  // buffer might contain partial input if a command was interrupted
  // updateInputDisplay will render it correctly with cursorPosition
  updateInputDisplay(); 
  document.body.focus();
}

function clearOutput() {
  output.innerHTML = "";
  buffer = "";
  cursorPosition = 0;
  updateInputDisplay(); // Clears visual input line
  previousCommands.length = 0;
  previousCommandIndex = 0;
  // done(); // done() might be redundant if updateInputDisplay covers it
  promptSymbol.style.display = "inline"; // Ensure prompt is visible
  promptSymbol.textContent = full_path + " ";
  blockCursor.style.display = "inline-block"; // Ensure cursor is visible
  document.body.focus();
}


// --- Keyboard Listeners ---
document.body.addEventListener("keydown", e => {
  if (e.key === "Control" || e.key === "Meta") {
    control_cmd = true;
    // e.preventDefault(); // Allow copy/paste shortcuts
    return;
  }

  if (commanding && e.key !== "c" && !(e.key === "Control" || e.key === "Meta")) { // if a command is running, only allow Ctrl+C
     if (control_cmd && e.key === "c") {
        // interrupt will be handled below
     } else {
        // e.preventDefault(); // Stop other keys from interfering
        return;
     }
  }


  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (previousCommands.length > 0 && previousCommandIndex > -previousCommands.length) {
      previousCommandIndex--;
      buffer = previousCommands.at(previousCommandIndex) || "";
      cursorPosition = buffer.length;
      updateInputDisplay();
    }
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (previousCommands.length > 0 && previousCommandIndex < 0) {
        previousCommandIndex++;
        buffer = previousCommands.at(previousCommandIndex) || "";
         if (previousCommandIndex === 0) buffer = ""; 
    } else {
        buffer = ""; 
    }
    cursorPosition = buffer.length;
    updateInputDisplay();
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (!isComposing && cursorPosition > 0) {
      cursorPosition--;
      
      updateInputDisplay();
    }
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    if (!isComposing && cursorPosition < buffer.length) {
      cursorPosition++;
      
      updateInputDisplay();
    }
    return;
  }


  //! Special Command Keys
  // Handle Ctrl+C for interruption or clearing line
  if (e.key.toLowerCase() === "c" && control_cmd) {
    e.preventDefault();
    if (commanding) {
        interrupt();
    } else if (buffer.trim() === "")
    {
      print(full_path);
      buffer = "";
      cursorPosition = 0;
      updateInputDisplay();
    }
    else {
        buffer = "";
        cursorPosition = 0;
        print(`${full_path} ${typedText.textContent}^C`); // Show current line content before clearing
        updateInputDisplay();
    }
    return;
  }

  if (e.key.toLowerCase() === "h" && control_cmd) {
    e.preventDefault();
    if (cursorPosition > 0) {
      if (cursorPosition - 2 >= 0 && buffer.substring(cursorPosition - 2, cursorPosition).startsWith("^")) {
        buffer = buffer.substring(0, cursorPosition - 2) + buffer.substring(cursorPosition);
        cursorPosition -=2 ;
      }
      else {
        buffer = buffer.substring(0, cursorPosition - 1) + buffer.substring(cursorPosition);
        cursorPosition--;
      }
      
    }
    updateInputDisplay();
  }
  else if (e.key.toLowerCase() === "i" && control_cmd) {
    e.preventDefault();
  }
  else if (e.key.length === 1 && control_cmd) {
    e.preventDefault();
    buffer += `^${e.key.toUpperCase()}`
    cursorPosition += 2;
    updateInputDisplay();
  }
  
  // For other Ctrl combinations (like Ctrl+V for paste), allow browser default if not handled
  if (control_cmd || e.metaKey || e.altKey) {
    // Specifically allow paste (Ctrl+V or Cmd+V)
    if ((control_cmd || e.metaKey) && e.key.toLowerCase() === 'v') {
        // Let paste event handle it by not preventing default and not returning early
    } else {
        return; // Let other Ctrl/Meta/Alt shortcuts behave normally or be ignored
    }
  }


  if (isComposing) return; // Let IME handle key events during composition

  if (e.key === "Backspace") {
    e.preventDefault();
    if (cursorPosition > 0) {
      if (cursorPosition - 2 >= 0 && buffer.substring(cursorPosition - 2, cursorPosition).startsWith("^")) {
        buffer = buffer.substring(0, cursorPosition - 2) + buffer.substring(cursorPosition);
        cursorPosition -=2 ;
      }
      else {
        buffer = buffer.substring(0, cursorPosition - 1) + buffer.substring(cursorPosition);
        cursorPosition--;
      }
      updateInputDisplay();
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (promptSymbol.style.display === "none" && commanding) {
        return; // If command is running and input is hidden, Enter does nothing
    }
    
    const commandToProcess = buffer.trim(); // Process the trimmed buffer
    if (commandToProcess === "") {
      print(`${full_path} ${buffer}`); // Echo the (potentially untrimmed) buffer content
    } else {
      if (buffer !== previousCommands.at(-1)) { // Avoid duplicate empty entries or same last command
         previousCommands.push(buffer); // Store original buffer with spaces if intended
         if (previousCommands.length > 20) previousCommands.shift();
      }
      previousCommandIndex = 0;
      processCommand(commandToProcess);
    }
    buffer = "";
    cursorPosition = 0;
    if (!commanding) { // only update display if not entering an awaiting state
        updateInputDisplay();
    }

  } else if (e.key.length === 1) { // Handles most printable characters
    e.preventDefault();
    buffer = buffer.substring(0, cursorPosition) + e.key + buffer.substring(cursorPosition);
    cursorPosition++;
    updateInputDisplay();
  }
  // Other keys (Tab, Escape, etc.) are currently ignored or default browser behavior
});

// Handle paste
document.body.addEventListener('paste', (e) => {
    if (isComposing || commanding || promptSymbol.style.display === "none") {
        return; // Don't paste if composing, command running, or input hidden
    }
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    buffer = buffer.substring(0, cursorPosition) + text + buffer.substring(cursorPosition);
    cursorPosition += text.length;
    updateInputDisplay();
});


// IME Composition Event Handlers
document.body.addEventListener('compositionstart', (e) => {
  if (commanding || promptSymbol.style.display === "none") return;
  isComposing = true;
  // Hide block cursor, updateInputDisplay will be called by compositionupdate or keydown
  blockCursor.style.display = "none"; 
  // Initial display before first compositionupdate event
  typedText.innerHTML = escapeHtml(buffer.substring(0, cursorPosition)) +
                        `<span class="composing-text"></span>` + // Empty composing span initially
                        escapeHtml(buffer.substring(cursorPosition));
});

document.body.addEventListener('compositionupdate', (e) => {
  e.preventDefault?.();
  if (commanding || promptSymbol.style.display === "none") return;
  if (!isComposing) return;
  // Display the currently composing text (e.data)
  // The text in `buffer` before `cursorPosition` and after `cursorPosition` remains unchanged
  typedText.innerHTML = escapeHtml(buffer.substring(0, cursorPosition)) +
                        `<span class="composing-text">${escapeHtml(e.data)}</span>` +
                        escapeHtml(buffer.substring(cursorPosition));
});

document.body.addEventListener('compositionend', (e) => {
  if (commanding || promptSymbol.style.display === "none") return;
  if (!isComposing) return; // Should not happen if logic is correct
  
  isComposing = false;
  const composedText = e.data;

  if (composedText) {
    buffer = buffer.substring(0, cursorPosition) + composedText + buffer.substring(cursorPosition);
    cursorPosition += composedText.length;
  }
  updateInputDisplay(); // Update to show final composed text and correct cursor
});


function interrupt() {
  if (commanding) {
    // print("^C"); // ping_func now prints ^C if interrupted during loop
    commanding = false;
    done();
  }
  // buffer = ""; // Don't clear buffer on interrupt, user might want to edit
  // cursorPosition = 0; // Don't reset cursor position
  updateInputDisplay();
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
  resizeTimeout = setTimeout(updateLinesOnResize, 150);
});

window.onload = () => {
  document.body.focus();
  updateCharacterWidth();
  welcomeMsg(); // This will print initial messages
  updateInputDisplay(); // Initialize the input display
};

function detectBrowser() {
    var userAgent = navigator.userAgent;
    if (userAgent.includes("Firefox/")) return "Firefox";
    if (userAgent.includes("Edg/")) return "Edge";
    if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/") && !userAgent.includes("OPR/")) return "Chrome";
    if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) return "Safari";
    if (userAgent.includes("OPR/") || userAgent.includes("Opera")) return "Opera";
    return "Unknown browser";
}

function welcomeMsg() {
    print(`Terminal Startup - ${detectBrowser()}`);
    print("Author: Tian Yi, Bao");
    print("");
    print("Type 'help' for a list of commands.");
    print("");
}

// If focus on terminal, focus on typedText
document.body.addEventListener("click", function() {
  setTimeout(() => {
    // 只有在没有选中文本时才 focus
    if (!window.getSelection().toString()) {
      // console.log("Focused");
      typedText.focus();
    }
  }, 0);
  // typedText.focus(); // 点击后聚焦到 edit div
});


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