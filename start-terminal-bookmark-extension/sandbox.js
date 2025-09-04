// sandbox.js - The Universal Executor
const pluginCommands = {};

console.log("Sandbox initialized");
// console.log(pluginCommands);

// 1. 定义一个沙箱版的API，它通过 postMessage 与主程序通信
const TerminalAPI = {
    registerCommand: (name, config) => {
        // 将函数体转换为字符串，因为函数本身无法通过 postMessage 传递
        const execAsString = config.exec ? config.exec.toString() : null;

        pluginCommands[name] = {
            exec: config.exec, // 在沙箱内部保留函数引用
            manual: config.manual
        };

        console.log(`[Sandbox] Posting 'plugin_command_registered' FOR ${name} back to main script.`);

        // 通知主程序，这个命令现在由插件处理
        parent.postMessage({
            type: 'plugin_command_registered',
            name: name
        }, '*');
    },
    print: (text, style = 'info', allowHtml = false) => {
        // 将冲突的变量名 type 改为 style
        parent.postMessage({ type: 'print', text, style, allowHtml }, '*');
    },
    getEnv: (key) => {
        // 异步获取环境变量，因为需要与主程序通信
        // (这是一个高级功能，可以稍后实现)
    },
    // 插件可以请求主程序执行别名
    executeCommand: (commandString) => {
        parent.postMessage({ type: 'execute_command', commandString }, '*');
    }
};

// 2. 监听来自主程序的消息
window.addEventListener('message', (event) => {
    const { type, name, args, code } = event.data;

    switch(type) {
        // 当主程序请求加载一个插件时
        case 'load_plugin':
            try {
                // 这是唯一需要 "eval" 的地方，在沙箱中是安全的
                const pluginFunction = new Function('TerminalAPI', code);
                pluginFunction(TerminalAPI);
            } catch (e) {
                TerminalAPI.print(`Error executing plugin code for '${name}': ${e.message}`, 'error');
            }
            break;

        // 当主程序请求执行一个插件命令时
        case 'run_plugin_command':
            if (pluginCommands[name] && typeof pluginCommands[name].exec === 'function') {
                const result = pluginCommands[name].exec(args);
                // 如果插件返回一个字符串，让主程序执行它（用于别名）
                if (typeof result === 'string') {
                    TerminalAPI.executeCommand(result);
                }
            }
            break;
    }
});