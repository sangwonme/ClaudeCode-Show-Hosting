---
name: show-hosting
description: Show a minimal dashboard of locally running servers — port, which project/code is running, and its URL. Use when the user runs /show-hosting or asks what is running on which port / what localhost servers are up.
---

Run:

```
node "${CLAUDE_SKILL_DIR}/show-hosting.js"
```

(If `${CLAUDE_SKILL_DIR}` is not substituted, use `~/.claude/skills/show-hosting/show-hosting.js`.)

It writes an HTML dashboard to the OS temp dir and opens it in the browser, and prints one line per port.
By default only dev runtimes (node, python, docker, ...) are shown. Pass `--all` if the user wants every
listening process. Pass `--no-open` if the user only wants the list in the terminal.

Reply with the printed list as a short table (port, URL, project). Do not add commentary.
