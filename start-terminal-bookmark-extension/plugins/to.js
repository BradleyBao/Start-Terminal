/**
 * to - A powerful shortcut manager for websites and site-specific searches.
 * This plugin demonstrates argument handling, conditional logic, and returning
 * command strings for the main terminal to execute.
 */
(function() {
    const shortcuts = {
        'gh': {
            'url': 'https://github.com/search?q=%s',
            'desc': 'Search on GitHub'
        },
        'npm': {
            'url': 'https://www.npmjs.com/search?q=%s',
            'desc': 'Search on NPM'
        },
        'yt': {
            'url': 'https://www.youtube.com/results?search_query=%s',
            'desc': 'Search on YouTube'
        },
        'maps': {
            'url': 'https://www.google.com/maps/search/%s',
            'desc': 'Search on Google Maps'
        },
        'def': {
            'url': 'https://www.merriam-webster.com/dictionary/%s',
            'desc': 'Look up a word in the Merriam-Webster dictionary'
        },
        'amazon': {
            'url': 'https://www.amazon.com/s?k=%s',
            'desc': 'Search on Amazon'
        },
        'edge': { 
            'url': 'https://learn.microsoft.com/en-us/microsoft-edge/',
            'desc': 'Go to the Microsoft Edge documentation'
        }
    };

    TerminalAPI.registerCommand('to', {
        exec: (args) => {
            const shortcutName = args[0];

            if (!shortcutName) {
                TerminalAPI.print("Available 'goto' shortcuts:", 'highlight');
                for (const name in shortcuts) {
                    const desc = shortcuts[name].desc;
                    TerminalAPI.print(`  ${name.padEnd(10, ' ')} - ${desc}`);
                }
                return; // 不需要执行任何命令，直接返回
            }

            const shortcut = shortcuts[shortcutName];

            // Case 2: 快捷方式不存在
            if (!shortcut) {
                TerminalAPI.print(`Error: Shortcut '${shortcutName}' not found.`, 'error');
                return;
            }

            const searchTerms = args.slice(1).join(' ');

            if (!searchTerms) {
                if (shortcut.url.includes('%s')) {
                    const baseUrl = new URL(shortcut.url).origin;
                    return `goto ${baseUrl}`;
                }
                return `goto ${shortcut.url}`;
            }

            if (shortcut.url.includes('%s')) {
                const finalUrl = shortcut.url.replace('%s', encodeURIComponent(searchTerms));
                return `goto -b ${finalUrl}`;
            } else {
                TerminalAPI.print(`Info: Shortcut '${shortcutName}' does not accept search terms. Navigating to base URL.`, 'warning');
                return `goto ${shortcut.url}`;
            }
        },
        manual: `NAME
  to - navigate to preset shortcuts or perform site-specific searches.

SYNOPSIS
  to [<shortcut>] [<search_term>]

DESCRIPTION
  A powerful shortcut manager.
  - 'to' with no arguments lists all available shortcuts.
  - 'to <shortcut>' navigates to the specified website.
  - 'to <shortcut> <search_term>' performs a search on that website.`
    });

})();
