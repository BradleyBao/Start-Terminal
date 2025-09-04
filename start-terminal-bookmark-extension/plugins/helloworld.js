// 无需 IIFE (自执行函数)，沙箱会处理作用域
TerminalAPI.registerCommand('hello', {
  exec: () => {
    TerminalAPI.print("World!", "success");
  },
  manual: 'Hello World.'
});
