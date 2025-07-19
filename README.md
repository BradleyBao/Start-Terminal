# Welcome to Start-Terminal 
A terminal-like browser starting page. 
![screenshot-1750943510940](https://github.com/user-attachments/assets/532c01ff-c542-43a1-b7ae-a406c928c762)
![screenshot-1750943448480](https://github.com/user-attachments/assets/f29ad0ab-a336-4f12-a88b-763c73b498b3)
![screenshot-1750943422784](https://github.com/user-attachments/assets/d6f5e789-be06-4a68-ad52-a7149d06c15f)

## Downloads
* Get it from [Microsoft Addons](https://microsoftedge.microsoft.com/addons/detail/pkaikemmelhclbkndohcoffnenhhhihp). 
* Get it from [Github](https://github.com/BradleyBao/Start-Terminal/releases).
* Get it from [Google Extension](https://chromewebstore.google.com/detail/start-terminal/hofionhfdcnjfohpmgjbkgfajddanhdh).
 
## To begin with 
```shell
help
```

## Avilable Commands 
```bash
--- Terminal Help ---

Search Commands
  google <query> [-b]   - Search with Google. (Only in MS Addon)
  bing <query> [-b]     - Search with Bing. (Only in MS Addon)
  baidu <query> [-b]    - Search with Baidu. (Only in MS Addon)
  yt <query> [-b]       - Search with YouTube. (Only in MS Addon)
  bilibili <query> [-b] - Search with Bilibili. (Only in MS Addon)
  spotify <query> [-b]  - Search with Spotify. (Only in MS Addon)
  search <query> [-b]   - Search with default search engine. (Only in Google Extension)

Theme & Background
  theme <theme_name>    - Change terminal theme (default, ubuntu, powershell, cmd, kali, debian).
  uploadbg              - Upload a custom background image.
  setbg [clear|<opacity>] - Set or clear custom background image or set opacity (0-1).
  setbgAPI <url>        - Set a random background image API URL for default image.

Navigation & Bookmarks
  goto <url> [-b]       - Navigate to a specific URL.
  gh                    - Navigate to GitHub.
  ls                    - List bookmarks and folders in current directory.
  cd <folder>           - Change directory to a bookmark folder.
  cd ..                 - Go to parent directory.
  ./<bookmark_name>     - Open a bookmark in the current directory.
  pwd                   - Show current bookmark path.
  mkdir <folder>   - Create a new bookmark folder.
  rm [-r] [-f] <folder / file>   - Remove a bookmark or folder.
  rmdir <folder>   - Remove an empty bookmark folder.

Account Management
  mslogin               - Log in with a Microsoft account.
  mslogout              - Log out from Microsoft account.

Utility Commands
  ping <host> [-n <count>] [-t] - Ping a host.
  date                  - Show current date and time.
  clear (or cls)        - Clear the terminal screen.
  locale                - Show browser language settings.

Settings & Features
  default <engine|on|off> - Set default search engine or toggle default mode.
  * All settings, command history, output history, and login status are saved automatically.

Command Options
  -b                    - Open search results or URL in a new background tab.
  -n <count>            - (ping) Number of pings to send.
  -t                    - (ping) Ping continuously until interrupted (Ctrl+C).
```
