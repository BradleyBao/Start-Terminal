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


function listChildren() {
  if (!current.children) {
    print("Not a directory")
    return ""
  }

  let printout = "";
  let index_child = 0;

  current.children.forEach((child, index) => {
    if (child.children) {
      // If last child 
      if (index_child === current.children.length - 1) {
        printLine(`${child.title}`, "folder", true); // Use true to indicate end of line
      } else {
        printLine(`${child.title}`, "folder");
      }
    } else {
      // If last child
      if (index_child === current.children.length - 1) {
        printLine(`${child.title}`, "file", true); // Use true to indicate end of line
      } else {
        // If not last child, just print the file name
        printLine(`${child.title}`, "file");
      }
    }
    index_child++;

  })
}

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
  const name = nameParts[0]; // Expecting an array, take the first part as the target
  if (!name) {
    print("cd: missing operand", "error");
    return;
  }

  if (name === "..") {
    if (path.length > 1) {
      path.pop();
      current = path[path.length - 1];
    }
    update_user_path();
    return;
  }

  const target = findChildByTitle(current.children || [], name);
  if (target && target.children) { // Ensure it's a directory
    current = target;
    path.push(current);
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
    print("");
    print("Default Search Engine:");
    print(`  - Current: ${default_search_engine}`);
    print("  - Change with: default <search engine> (google, bing, baidu)");
    print("  - Turn on / off default mode with: default on / off");
    print("");
    print("Options:");
    print("  -b: Open search results or URL in a new tab.");
    print("  -t: (ping) Ping continuously.");
    print("  -n <count>: (ping) Number of pings.");
    print("");
    print("Navigation:");
    print("  ArrowUp/ArrowDown: Cycle through command history.");
    print("  ArrowLeft/ArrowRight: Move cursor in the current command line.");
    print("  Ctrl+C: Interrupt running command or clear current input line.");
    return " ";
  }
};

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
    lineDiv.textContent = textStr + filledText + "\t"; // Add spaces to fill the line
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

function awating() {
  typedText.innerHTML = "";
  blockCursor.style.display = "none";
  promptSymbol.style.display = "none";
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
}

function clearOutput() {
  output.innerHTML = "";
  // Welcome message can be re-added if desired, or keep it minimal
  // welcomeMsg();
  // No need to reset buffer/cursor here as it's for visual output
  // Buffer clearing is handled by Enter key logic
  done(); // Redraw prompt and input display
}


// --- Keyboard Listeners ---
document.body.addEventListener("keydown", e => {
  if (e.key === "Control" || e.key === "Meta") {
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
    if (!isComposing && cursorPosition > 0) {
      e.preventDefault();
      cursorPosition--;
      updateInputDisplay();
    } // Allow default if composing for IME navigation
    return;
  }
  if (e.key === "ArrowRight") {
    if (!isComposing && cursorPosition < buffer.length) {
      e.preventDefault();
      cursorPosition++;
      updateInputDisplay();
    } // Allow default if composing
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
  
  // --- Tab Autocompletion ---
  // 替换你 script.js 文件中 document.body.addEventListener("keydown", e => { ... });
// 内部的 if (e.key === "Tab") { ... } 代码块

if (e.key === "Tab") {
    e.preventDefault();
    const relevantInput = buffer.substring(0, cursorPosition);
    // 使用一个更简单的 split 来获取命令名，因为我们主要关心第一个 token 是否为特殊命令
    const pre_parts = relevantInput.trimStart().split(/\s+/);
    let commandName = pre_parts[0] || "";

    let prefixPath = ""; // 例如 "folder/"，在当前补全参数内部的路径前缀
    let namePrefixToComplete = ""; // 例如 "myFile"，用户正在输入的文件/目录名部分
    let currentContextChildren = current.children; // 默认为当前目录的子节点
    let effectiveCommandType = ""; // 用于指导过滤逻辑："cd", "ls", "./"

    // 这是当前正在处理的完整参数字符串
    // 例如：如果输入是 "cd myfolder/sub"，那么这个字符串就是 "myfolder/sub"
    let baseArgumentString = "";
    // 这个参数字符串在 relevantInput 中的起始索引
    let startOfBaseArgumentStringInRelevantInput = 0;

    if (commandName.startsWith("./")) {
        effectiveCommandType = "./";
        startOfBaseArgumentStringInRelevantInput = "./".length; // "./" 之后的内内容是参数
        baseArgumentString = relevantInput.substring(startOfBaseArgumentStringInRelevantInput);

        const lastSlashPos = baseArgumentString.lastIndexOf('/');
        if (lastSlashPos > -1) {
            prefixPath = baseArgumentString.substring(0, lastSlashPos + 1);
            namePrefixToComplete = baseArgumentString.substring(lastSlashPos + 1);
        } else {
            prefixPath = ""; // 参数内没有路径前缀
            namePrefixToComplete = baseArgumentString;
        }
        // getChildrenAtPath 应该返回 current 目录下，由 prefixPath 指定的子目录中的内容
        currentContextChildren = getChildrenAtPath(current, prefixPath.endsWith('/') ? prefixPath.slice(0, -1) : prefixPath);

    } else if (commandName === "cd" || commandName === "ls") {
        effectiveCommandType = commandName;
        // 确定参数部分的起始位置和内容
        const commandEndIndex = relevantInput.indexOf(commandName) + commandName.length;
        let potentialArgStringStart = relevantInput.substring(commandEndIndex); // 获取命令后的所有字符
        
        // 检查命令后是否有空格，确定参数的实际开始
        const firstSpaceMatch = potentialArgStringStart.match(/^\s+/);
        if (firstSpaceMatch) { // 如果命令后有空格
            startOfBaseArgumentStringInRelevantInput = commandEndIndex + firstSpaceMatch[0].length;
            baseArgumentString = relevantInput.substring(startOfBaseArgumentStringInRelevantInput);

            const lastSlashPos = baseArgumentString.lastIndexOf('/');
            if (lastSlashPos > -1) {
                prefixPath = baseArgumentString.substring(0, lastSlashPos + 1);
                namePrefixToComplete = baseArgumentString.substring(lastSlashPos + 1);
            } else {
                prefixPath = "";
                namePrefixToComplete = baseArgumentString;
            }
            
            // 如果baseArgumentString以空格结尾 (例如 "cd mydir "), 那么实际是在补全 mydir 内部的内容
            // 或者在 "cd myfolder/ " 之后补全
            if (relevantInput.endsWith(" ")) {
                 const trimmedBaseArg = baseArgumentString.trim();
                 if (trimmedBaseArg !== "" && !trimmedBaseArg.endsWith("/")) {
                    // prefixPath = trimmedBaseArg + "/";
                 } else {
                    prefixPath = trimmedBaseArg; // 可能是 "folder/" 或 ""
                 }
                 if (!prefixPath.endsWith("/") && prefixPath !== "") prefixPath += "/";

                 namePrefixToComplete = "";
            }

        } else if (pre_parts.length === 1 && !potentialArgStringStart) {
             // 只有命令本身，例如 "cd" 然后按 Tab，或者 "ls" 然后按 Tab
             // 这种情况下，我们补全当前目录的内容，namePrefixToComplete 为空
            namePrefixToComplete = "";
            prefixPath = "";
            startOfBaseArgumentStringInRelevantInput = cursorPosition; // 准备在光标处追加
        } else {
             // 命令后直接跟参数，无空格，例如 "cdmyparam" (这在您的解析器中可能不被视为 "cd" 命令加参数)
             // 或者其他不符合 "命令 参数" 结构的情况
             // 如果您的命令解析要求 "command" 和 "argument" 之间必须有空格，
             // 那么 "cdpartialarg" 会被看作一个整体的 commandName，不会进入这个 "cd"||"ls" 分支。
             // 此处假设命令和参数已用空格分开，或者正准备输入第一个参数。
            return; 
        }
        currentContextChildren = getChildrenAtPath(current, prefixPath.endsWith('/') ? prefixPath.slice(0, -1) : prefixPath);

    } else {
        return; // 不是可进行路径补全的已知命令
    }

    if (!currentContextChildren) currentContextChildren = []; // 确保是数组以防出错

    let matches = currentContextChildren
        .filter(child => {
            const title = child.title || "";
            // 忽略大小写进行匹配
            if (!title.toLowerCase().startsWith(namePrefixToComplete.toLowerCase())) return false;
            if (effectiveCommandType === "cd") return !!child.children; // 'cd' 只补全目录
            return true; // './' 和 'ls' 补全文件和目录
        })
        .map(child => child.title)
        .sort(); // 按字母排序

    if (matches.length === 1) {
        const match = matches[0];
        const matchedNode = currentContextChildren.find(c => c.title === match);

        let completedSegmentOfName = match; // 匹配到的实际文件/目录名
        if (matchedNode && matchedNode.children) {
            // completedSegmentOfName += "/"; // 如果是目录，则在其名称后添加 "/"
        }

        let finalInsertionText;
        if (effectiveCommandType === "cd") {
            // 对于 'cd'，整个路径参数（prefixPath + completedSegmentOfName）会被引号包围
            finalInsertionText = `"${prefixPath + completedSegmentOfName}"`;
        } else { // 对于 './' 和 'ls'
            finalInsertionText = prefixPath + completedSegmentOfName;
        }

        // replaceFrom 是参数部分的起始位置
        // replaceTo 是当前光标位置，即用户已输入部分的末尾
        const replaceFrom = startOfBaseArgumentStringInRelevantInput;
        const replaceTo = cursorPosition;

        buffer = buffer.substring(0, replaceFrom) + finalInsertionText + buffer.substring(replaceTo);
        cursorPosition = replaceFrom + finalInsertionText.length;
        updateInputDisplay();

    } else if (matches.length > 1) {
        let commonPrefix = matches[0]; // 假设 matches 不为空
        for (let i = 1; i < matches.length; i++) {
            while (commonPrefix.length > 0 && !matches[i].toLowerCase().startsWith(commonPrefix.toLowerCase())) {
                commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
            }
            if (commonPrefix === "") break; // 如果没有公共前缀，则停止
        }

        if (commonPrefix.length > namePrefixToComplete.length) {
            // 只补全到公共前缀部分
            const partialCompletionText = prefixPath + commonPrefix;
            const replaceFrom = startOfBaseArgumentStringInRelevantInput;
            const replaceTo = cursorPosition;

            buffer = buffer.substring(0, replaceFrom) + partialCompletionText + buffer.substring(replaceTo);
            cursorPosition = replaceFrom + partialCompletionText.length;
            updateInputDisplay();
        }

        // 打印所有匹配项供用户选择
        print(full_path + " " + buffer.substring(0, cursorPosition)); // 回显当前输入行
        let outputLineContent = "";
        matches.forEach(m => {
            const node = currentContextChildren.find(c => c.title === m);
            outputLineContent += m + (node && node.children ? "/" : "") + "   "; // 目录后加斜杠，并用空格隔开
        });
        print(outputLineContent.trim(), "placeholder"); // "placeholder" 是您之前使用的样式类型
        done(); // 重绘提示符和输入区域
    }
    // 如果没有匹配项，或者公共前缀不比已输入的长，则不执行任何操作 (可以添加提示音)
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
    e.preventDefault();
    if (cursorPosition > 0) {
      const charToDelete = buffer.substring(cursorPosition -1, cursorPosition);
      // Basic backspace, could be enhanced for ^H like behavior if needed
      buffer = buffer.substring(0, cursorPosition - 1) + buffer.substring(cursorPosition);
      cursorPosition--;
      updateInputDisplay();
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (promptSymbol.style.display === "none" && commanding) return;

    const commandToProcess = buffer.trim();
    if (buffer.length > 0 && (!previousCommands.length || buffer !== previousCommands.at(-1))) {
         previousCommands.push(buffer);
         if (previousCommands.length > 50) previousCommands.shift(); // Limit history size
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
  updateCharacterWidth(); // Update char width first
  const lines = output.querySelectorAll(".output-line[data-raw-text]"); // More specific selector
  lines.forEach(lineDiv => rewrapLine(lineDiv));
}


let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(updateLinesOnResize, 150); // Debounce resize
});

window.onload = () => {
  // No explicit body focus, let browser decide or user click.
  // typedText.focus() will be called by done() or click handler.
  updateCharacterWidth(); // Initial calculation
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
    print(`Terminal Startup - ${detectBrowser()}`);
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