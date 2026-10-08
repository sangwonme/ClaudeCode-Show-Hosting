# show-hosting

A Claude Code skill. `/show-hosting` opens a minimal dashboard of local servers: port, project, command and URL (with the page title when the port serves HTML).

Works on Windows, macOS and Linux. Requires Node 18 or later and no npm dependencies.

## Install

```
git clone https://github.com/sangwonme/ClaudeCode-Show-Hosting.git ~/.claude/skills/show-hosting
```

On Windows PowerShell, use `$HOME\.claude\skills\show-hosting` as the target. Run `git pull` in that folder to update.

## Run directly

```
node ~/.claude/skills/show-hosting/show-hosting.js [--all] [--no-open]
```

- `--all`: include non-dev processes such as Steam, Drive and VS Code internals.
- `--no-open`: print the list only and do not open the browser.

## How it works

- The script reads listening ports from `netstat -ano` on Windows and from `lsof` on macOS/Linux. It only lists processes owned by the current user.
- The project folder comes from the process cwd on macOS/Linux. Windows does not expose the cwd of another process, so the script looks for an absolute path in the command line of the process or its parents.
- The script sends a GET request to `localhost:<port>` to check whether the port serves HTTP and to read the page title.
