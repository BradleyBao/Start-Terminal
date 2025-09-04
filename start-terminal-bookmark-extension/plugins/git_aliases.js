// 无需 IIFE (自执行函数)，沙箱会处理作用域
TerminalAPI.registerCommand('ga', {
  exec: () => {
    // 直接返回字符串，由主程序执行，这是最简单的别名实现
    return 'git add .';
  },
  manual: 'Alias for "git add ."'
});

TerminalAPI.registerCommand('gc', {
  exec: (args) => {
    // 插件现在可以包含自己的逻辑
    const message = args.length > 0 ? args.join(' ') : "WIP";
    TerminalAPI.print(`Committing with message: ${message}`, 'info');
    return `git commit -m "${message.replace(/"/g, '\\"')}"`;
  },
  manual: 'Alias for "git commit -m <message>"'
});

TerminalAPI.print("Git Aliases plugin loaded via Sandbox.", "success");
