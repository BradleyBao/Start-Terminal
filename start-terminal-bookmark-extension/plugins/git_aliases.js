// 文件名: git_aliases.js
(function() {
  // 检查 TerminalAPI 是否存在，防止插件在不支持的环境中运行出错
  if (!window.TerminalAPI) {
    console.error("TerminalAPI not found. Plugin 'git_aliases' cannot be loaded.");
    return;
  }

  TerminalAPI.registerCommand('ga', {
    exec: () => 'git add .', // 返回一个字符串，终端会自动执行它
    manual: 'Alias for "git add ."'
  });

  TerminalAPI.registerCommand('gc', {
    exec: (args) => {
      if (args.length === 0) {
        return 'git commit -m "WIP"'; // 默认提交信息
      }
      const message = args.join(' ');
      // 注意：需要正确处理引号
      return `git commit -m "${message.replace(/"/g, '\\"')}"`;
    },
    manual: 'Alias for "git commit -m <message>"'
  });

  TerminalAPI.print("Git Aliases plugin loaded.", "success");

})();