// script.js

const output = document.getElementById("output");
const typedText = document.getElementById("typedText");
const terminal = document.getElementById("terminal");
const promptSymbol = document.getElementById("promptSymbol");

var control_cmd = false;
var commanding = false;
let buffer = "";
const previousCommands = [];
let previousCommandIndex = 0;

let cursorPosition = 0; // Tracks the cursor position within the buffer
let isComposing = false; // For IME input


// Function to measure character width
function getMonospaceCharacterWidth() {
    const span = document.createElement('span');
    span.textContent = ' '; // Use a space or any representative character like 'M'
    // Apply the same styles as your output lines for accuracy
    span.style.fontFamily = 'Consolas, monospace'; // Match .output-line-powershell CSS
    span.style.fontSize = '16px';                 // Match .output-line-powershell CSS
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    
    // Append to output to inherit relevant styles if 'output' is already available
    const parentElement = document.getElementById("output") || document.body;
    parentElement.appendChild(span);
    const width = span.getBoundingClientRect().width;
    parentElement.removeChild(span);
    
    return width > 0 ? width : 8; // Fallback to a reasonable default (e.g., 8px for 16px font)
}

// Use 'let' as it will be updated on resize/zoom
let CHARACTER_WIDTH = getMonospaceCharacterWidth();

// Function to update CHARACTER_WIDTH if needed (e.g., on resize/zoom)
function updateCharacterWidth() {
    CHARACTER_WIDTH = getMonospaceCharacterWidth();
}



// --- Commands Object (assumed mostly unchanged, ensure help text is plain) ---
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
  gh: () => location.href = "https://github.com",
  help: () => {
    print("Commands Available:");
    print(" - google <query> [-b]: Search Google for the specified query.");
    print(" - youtube <query> [-b]: Search YouTube for the specified query.");
    print(" - bing <query> [-b]: Search Bing for the specified query.");
    print(" - ping <host> [-t] [-n <count>]: Ping a host, with optional continuous or count options.");
    print(" - goto <url> [-b]: Navigate to the specified URL, with optional new tab.");
    print(" - date: Show the current date and time.");
    print(" - clear: Clear the terminal output.");
    print(" - help: Show this help message.");
    return " ";
  }
};

// ---------------------------
// 命令解析器
// ---------------------------
function parseCommandLine(input) {
  const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(t => t.replace(/^"|"$/g, ""));
  if (!tokens || tokens.length === 0) return null;

  const command = tokens.shift();
  const args = [];
  const options = {};

  // Specific Options
  const optionRequiresValue = {
    ping: ["n"], // ping 's -n option requires a value'
    google: [], 
    yt: [],
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
  done();
}


// MODIFIED print function
function print(text, type="info") {
  const lineWidth = output.clientWidth;
  const charWidth = CHARACTER_WIDTH;

  // Fallback if charWidth is not available (e.g., during initial load issues)
  if (charWidth === 0) {
    console.warn("Character width is zero, printing without padding.");
    const lineDiv = document.createElement('div');
    lineDiv.className = 'output-line output-line-powershell';
    lineDiv.setAttribute('data-raw-text', String(text)); // Store original text
    lineDiv.textContent = String(text); // Ensure text is string
    output.appendChild(lineDiv);
    window.scrollTo(0, document.body.scrollHeight);
    return;
  }
  
  const textStr = String(text); // Ensure text is a string
  const totalTextPixelWidth = textStr.length * charWidth;
  let numSpaces = 0;

  if (totalTextPixelWidth < lineWidth) {
    // Text is shorter than one line
    numSpaces = Math.floor((lineWidth - totalTextPixelWidth) / charWidth);
  } else {
    // Text is longer than or equal to one line and might wrap
    const lastLineActualPixelWidth = totalTextPixelWidth % lineWidth;
    if (lastLineActualPixelWidth === 0 && totalTextPixelWidth > 0) {
      // Text fits exactly into N lines, or is a multiple of lineWidth
      numSpaces = 0; // No padding needed as the last line is full
    } else {
      // Text wraps, and the last line has content (lastLineActualPixelWidth > 0)
      // Or text is empty (totalTextPixelWidth = 0), then lastLineActualPixelWidth = 0
      numSpaces = Math.floor((lineWidth - lastLineActualPixelWidth) / charWidth);
    }
  }
  
  numSpaces = Math.max(0, numSpaces); // Ensure non-negative
  const filledText = " ".repeat(numSpaces);

  const lineDiv = document.createElement('div');
  lineDiv.className = `output-line output-line-powershell output-${type}`;
  lineDiv.setAttribute('data-raw-text', textStr); // Store original text
  lineDiv.textContent = textStr + filledText;   // Use textContent for safety if text is not HTML

  output.appendChild(lineDiv);
  window.scrollTo(0, document.body.scrollHeight);
}

// --- processCommand, awating, done (ensure done() re-enables input correctly) ---
function processCommand(input) {
  print(`$ ${input}`); // Echo command with padding
  const parsed = parseCommandLine(input);
  if (!parsed) {
      print("Invalid command syntax."); // Provide more specific feedback
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
    print(`Unknown command: '${command}' (try 'help')`, "error");
    print("");
  }
}

function awating() {
  typedText.textContent = "";
  promptSymbol.style.display = "none"; // Hide prompt symbol
}

function done() {
  promptSymbol.style.display = "inline"; // Show prompt symbol
  promptSymbol.textContent = "$ "; // Ensure prompt symbol text is correct
  typedText.textContent = buffer; // Restore buffer if needed, or clear
  // Ensure cursor is visible and input is focusable again
  document.body.focus(); // Or focus a specific input element if you change structure
}

function clearOutput() {
  output.innerHTML = ""; // Clear all output lines
  typedText.textContent = ""; // Clear typed text
  buffer = ""; // Reset buffer
  previousCommands.length = 0; // Clear command history
  previousCommandIndex = 0; // Reset command index
  done(); // Restore prompt state
}

// --- Keyboard Listeners (largely unchanged, ensure buffer/typedText are handled) ---
document.body.addEventListener("keydown", e => {
  if (e.key === "Control" || e.key === "Meta") {
    control_cmd = true;
    e.preventDefault();
    return;
  }
  // ... (ArrowUp, ArrowDown logic as before) ...
  if (e.key === "ArrowUp") {
    if (previousCommands.length > 0 && previousCommandIndex > -previousCommands.length) {
      previousCommandIndex--;
      buffer = previousCommands.at(previousCommandIndex) || "";
      typedText.textContent = buffer;
    }
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowDown") {
    if (previousCommands.length > 0 && previousCommandIndex < 0) {
        previousCommandIndex++;
        buffer = previousCommands.at(previousCommandIndex) || "";
         if (previousCommandIndex === 0) buffer = ""; // Clear if back to "current"
    } else {
        buffer = ""; // Clear if already at current or no history
    }
    typedText.textContent = buffer;
    e.preventDefault();
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
  else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (!isComposing && cursorPosition < buffer.length) {
      cursorPosition++;
      updateInputDisplay();
    }
    return;
  }


  if (e.key === "Backspace") {
    buffer = buffer.slice(0, -1);
  } else if (e.key === "Enter") {
    if (promptSymbol.style.display === "none" && commanding) { // If a command is running
        // Potentially send input to command or ignore
        return;
    }
    if (buffer.trim() === "") {
      print(`$ ${buffer}`); // Print prompt and empty buffer
      // buffer = ""; // Buffer already empty or just spaces
      // typedText.textContent = buffer;
      // return; // No command to process
    } else {
        previousCommands.push(buffer);
        if (previousCommands.length > 20) previousCommands.shift(); // Limit history
        previousCommandIndex = 0; // Reset index to point "after" the last command
        processCommand(buffer.trim());
    }
    buffer = ""; // Clear buffer for next command

  } else if (e.key === "c" && control_cmd) {
    if (commanding) {
        interrupt();
    } else {
        buffer = ""; // Clear current input buffer
        print(`$ ${buffer}`); // Show empty prompt
    }
    e.preventDefault();
    return;
  }
  // Filter out non-printable keys, except space
  else if (e.key.length === 1) { // Handles most printable characters including space
    buffer += e.key;
  } 
  typedText.textContent = buffer;
});

function interrupt() {
  if (commanding) {
    print("^C");
    commanding = false; // Signal async command to stop
    done(); // Restore prompt
  }
   buffer = ""; // Clear current input buffer
   typedText.textContent = buffer;
}

document.body.addEventListener("keyup", e => {
  if (e.key === "Control" || e.key === "Meta") {
    control_cmd = false;
  }
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

// Composition
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

// document.body.addEventListener("click", e => {
//   // Ensure the body is focused to capture keydown events
//   e.preventDefault();
// }
// );

// NEW function to update lines on resize
function updateLinesOnResize() {
  updateCharacterWidth(); // Recalculate char width in case of zoom
  const newLineWidth = output.clientWidth;
  const charWidth = CHARACTER_WIDTH;

  if (charWidth === 0) {
    // console.warn("Character width is zero on resize, cannot update lines.");
    return; 
  }

  const lines = output.getElementsByClassName("output-line");
  for (let i = 0; i < lines.length; i++) {
    const lineDiv = lines[i];
    const rawText = lineDiv.getAttribute("data-raw-text");

    if (rawText === null) continue; // Skip if no raw text stored

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

// Debounce resize handler for performance
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(updateLinesOnResize, 150); // Adjust delay (e.g., 100-250ms)
});

// Initial setup on window load
window.onload = () => {
  document.body.focus(); // Focus the body to capture keydown events
  updateCharacterWidth(); // Initial calculation of CHARACTER_WIDTH
  // Optionally call updateLinesOnResize if there's any pre-rendered content
  // that needs alignment on load, though usually output starts empty.
  // updateLinesOnResize(); 
};

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

function detectBrowser() {
    var userAgent = navigator.userAgent;
    if (userAgent.includes("Firefox/")) {
    return "Firefox";
  } else if (userAgent.includes("Edg/")) {
    return "Edge";
  } else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/") && !userAgent.includes("OPR/")) {
    return "Chrome";
  } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) {
    return "Safari";
  } else if (userAgent.includes("OPR/") || userAgent.includes("Opera")) {
    return "Opera";
  } else {
    return "Unknown browser";
  }
}

function welcomeMsg() {
    print(`Terminal Startup - ${detectBrowser()}`);
    print("Author: Tian Yi, Bao");
    print("");
    print("Type 'help' for a list of commands.");
    print("");
}

welcomeMsg();


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