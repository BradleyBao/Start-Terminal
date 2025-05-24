const output = document.getElementById("output");
const typedText = document.getElementById("typedText");
const terminal = document.getElementById("terminal");
const promptSymbol = document.getElementById("promptSymbol");

var control_cmd = false; // Determine if control is pressed

var commanding = false; // Determine if a command is running
// Import the Ping class from ping.js
// import {Ping} from "./ping.js";

let buffer = "";

const previousCommands = [];
let previousCommandIndex = 0; // Index for navigating through previous commands

function getMonospaceCharacterWidth() {
    const span = document.createElement('span');
    span.textContent = ' '; // Use a space character for measuring space width
    // Apply the same styles as your output lines
    span.style.fontFamily = 'Consolas, monospace'; // From .output-line-powershell CSS
    span.style.fontSize = '16px';                 // From .output-line-powershell CSS
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    document.body.appendChild(span);
    const width = span.getBoundingClientRect().width;
    document.body.removeChild(span);
    return width > 0 ? width : 8; // Fallback to a reasonable default (e.g., 8px)
}

// Cache the character width on script load
const CHARACTER_WIDTH = getMonospaceCharacterWidth();

// ---------------------------
// 命令注册
// ---------------------------
const commands = {
  google: (args, options) => {
    if (args.length === 0) return "Usage: google [query]";
    const query = args.join(" ");
    location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return true;
  },
  youtube: (args, options) => {
    if (args.length === 0) return "Usage: yt [query]";
    const query = args.join(" ");
    location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
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
  gh: () => location.href = "https://github.com",
  help: () => {
    print("Available commands:");
    print(" - google [query]: Search Google for the specified query.");
    print(" - yt [query]: Search YouTube for the specified query.");
    print(" - ping <host> [-t] [-n <count>]: Ping a host, with optional continuous or count options.");
    print(" - gh: Go to GitHub.");
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
    ping: ["n"], // ping 的 -n 是带值的，其它不是
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
          print(`Failed to ping ${url}: ${error}`);
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

// function ping_func(url, options) {
//   const start = Date.now();
//   const xhr = new XMLHttpRequest();
//   xhr.open('HEAD', url, true);
//   xhr.onload = () => {
//     const latency = Date.now() - start;
//     console.log(`Ping to ${url}: ${latency} ms`);
//   };
//   xhr.onerror = () => {
//     console.error(`Failed to ping ${url}`);
//   };
//   xhr.send();
// }


// ---------------------------
// 命令执行器
// ---------------------------
function processCommand(input) {
  print(`$ ${input}`);
  const parsed = parseCommandLine(input);
  if (!parsed) return print("Invalid command");

  const { command, args, options } = parsed;
  const action = commands[command];
  
  if (action) {
    const result = action(args, options);
    // console.log(typeof result === "boolean");
    if (typeof result === "string") print(result);
    else if (typeof result === "boolean" && result) {
      // Disable the input line with id typedText
      awating();
      return
    }
    else if (typeof result === "boolean" && !result) {
      print(`Command '${command}' failed.`);
    }
  } else {
    print(`Unknown command: '${command}' (try 'help')`);
  }
}

function awating() {
  // Disable the input line with id typedText
  typedText.textContent = "";
  promptSymbol.textContent = "";
  // Add a loading animation or message
  promptSymbol.style.display = "none";
}

function done() {
  // Enable the input line with id typedText
  promptSymbol.style.display = "inline";
  typedText.textContent = buffer;
  promptSymbol.textContent = "$ ";
}

// ---------------------------
// 输出到终端
// ---------------------------
function print(text) {
  // Use output.clientWidth for a more accurate line width
  const lineWidth = output.clientWidth;
  
  // Use the dynamically calculated (or adjusted) character width
  const charWidth = CHARACTER_WIDTH; // Or your manually adjusted value if using Option A

  // Ensure charWidth is not zero to prevent division by zero
  if (charWidth === 0) {
    console.error("Character width is zero, cannot calculate spaces.");
    output.innerHTML += `<div class="output-line output-line-powershell">${text}</div>`;
    window.scrollTo(0, document.body.scrollHeight);
    return;
  }

  const textRenderedWidth = text.length * charWidth;
  const numSpaces = Math.floor(Math.max(0, (lineWidth - textRenderedWidth) / charWidth));
  const filledText = " ".repeat(numSpaces);
  
  // The rest of your console.log for debugging can be kept or removed
  // console.log(lineWidth, text.length, filledText.length, charWidth); 

  output.innerHTML += `<div class="output-line output-line-powershell">${text}${filledText}</div>`;
  window.scrollTo(0, document.body.scrollHeight);
}

// ---------------------------
// 键盘监听（仿终端）
// —---------------------------
document.body.addEventListener("keydown", e => {
  // console.log(e.key);
  if (e.key === "Control" || e.key === "Meta") {
    // Ignore Control and Meta keys
    control_cmd = true;
    e.preventDefault(); // Prevent default behavior of Control and Meta keys
    return;
  }
  else if (e.key === "ArrowUp") {
    // If the user presses ArrowUp, show the previous command
    if (previousCommands.length > 0 && previousCommandIndex >= -previousCommands.length) {
      // console.log(previousCommandIndex, previousCommands.at(previousCommandIndex));
      previousCommandIndex--;
      buffer = previousCommands.at(previousCommandIndex) || "";
      typedText.textContent = buffer;
      promptSymbol.textContent = "$ ";
      
      e.preventDefault(); // Prevent default behavior of ArrowUp
    }
    return;
  }
  else if (e.key === "ArrowDown") {
    // If the user presses ArrowDown, show the next command
    if (previousCommands.length > 0 && previousCommandIndex <= 0) {
      // console.log(previousCommandIndex, previousCommands.at(previousCommandIndex));
      if (previousCommandIndex == 0) {
        buffer = "";
        typedText.textContent = buffer;
        promptSymbol.textContent = "$ ";
        return;
      }
      previousCommandIndex++;
      buffer = previousCommands.length > 0 ? previousCommands.at(previousCommandIndex) : "";
      typedText.textContent = buffer;
      promptSymbol.textContent = "$ ";
      e.preventDefault(); // Prevent default behavior of ArrowDown
    }
  }
  if (e.key === "Backspace") {
    buffer = buffer.slice(0, -1);
  } else if (e.key === "Enter") {
    // If the user just entered space, we should not process the command
    if (buffer.trim() === "") {
      print(`$ ${buffer}`);
      buffer = "";
      typedText.textContent = "";
      promptSymbol.textContent = "$ ";
      return;
    }
    previousCommands.push(buffer);
    processCommand(buffer.trim());
    buffer = "";
  } 
  else if (e.key === "c" && control_cmd) {
    // If Control+C is pressed, clear the input buffer
    buffer = "";
    typedText.textContent = "";
    promptSymbol.textContent = "$ ";
    interrupt();
    e.preventDefault(); // Prevent default behavior of Control+C
    return;
  }
  else if (e.key.length === 1) {
    buffer += e.key;
  } 
  // Include Space
  typedText.textContent = buffer;
});


function interrupt() {
  // If the user presses Control+C, clear the input buffer
  // Print ^C to the output
  console.log(buffer);
  if (commanding){
    print(`^C`);
    buffer = "";
    typedText.textContent = "";
    promptSymbol.textContent = "$ ";
  }
  else if (buffer === "") {
    print(`$ ${buffer}`);
  } 
  commanding = false; // Reset command running state
}

document.body.addEventListener("keyup", e => {
  // console.log(e.key);
  if (e.key === "Control" || e.key === "Meta") {
    // Reset control_cmd when Control or Meta key is released
    control_cmd = false;
    // console.log(control_cmd);
  }
  // // If the user presses Enter, we should not show the prompt symbol
  // if (e.key === "Enter") {
  //   promptSymbol.textContent = "";
  // } else {
  //   promptSymbol.textContent = "$ ";
  // }
});

window.onload = () => {
  document.body.focus();
};









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