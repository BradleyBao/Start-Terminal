/**
 * common_aliases - Adds a set of convenient, widely-used aliases.
 * This plugin demonstrates how to register multiple simple alias commands in a loop.
 */
(function() {
    // Def common alias
    const aliases = {
        // 'ls' shortcut
        'l': 'ls -l',      // Long List 
        'la': 'ls -a',     // Show all files
        'll': 'ls -la',    // Show all long list files

        // directory
        '..': 'cd ..',
        '...': 'cd ../..',
        '....': 'cd ../../..',

        // other shortcuts
        'h': 'history',    // history 的缩写
        'c': 'clear'       // clear 的缩写
    };

    // for loop to register aliases 
    for (const name in aliases) {
        const command = aliases[name];
        
        // register commands 
        TerminalAPI.registerCommand(name, {
            exec: (function(cmd) {
                return function(args) {
                    return cmd + ' ' + args.join(' ');
                }
            })(command),
            manual: `Alias for the command: "${command}"`
        });
    }

    // Add an info 
    TerminalAPI.print("Common Aliases plugin loaded", "success");

})();
