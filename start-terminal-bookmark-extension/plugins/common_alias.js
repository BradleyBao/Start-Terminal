/**
 * common_aliases - Adds a set of convenient, widely-used aliases to enhance productivity.
 * This plugin provides shortcuts for file operations, navigation, system commands, and more.
 */
(function() {
    // Common Names Definition 
    const aliases = {
        // ls alises for directories 
        // integrated ls supports -l and -a 
        'l': 'ls',      // Normal ls
        'la': 'ls -a',     // All Files 
        'll': 'ls -la',    // Long List with All Files 

        // cd aliases 
        '..': 'cd ..',
        '...': 'cd ../..',
        '....': 'cd ../../..',

        // Configuration
        'editrc': 'nano ~/.startrc', // Quick Edit .startrc
        'sourcerc': 'source ~/.startrc', // Quick load .startrc

        // Find names
        'ff': 'find -name', // "Find File" shortcut, `ff "*query*"`

        // Browsers Integrated 
        'lt': 'tabs ls',      // "List Tabs", `tabs ls`
        'dl': 'downloads ls', // "Downloads List", `downloads ls`
        
        // Common tools Aliases
        'h': 'history',
        'c': 'clear',
        'n': 'nano',
        'v': 'vim',
    };

    // Look through aliases and register 
    for (const name in aliases) {
        const command = aliases[name];
        
        // Make sure it captured
        TerminalAPI.registerCommand(name, {
            exec: (function(cmd) {
                return function(args) {
                    return cmd + ' ' + args.join(' ').trim();
                }
            })(command),
            manual: `Alias for the command: "${command}"`
        });
    }

    // 一个更具信息量的加载消息
    TerminalAPI.print("Common Aliases plugin updated. ", "success");

})();
