# Security policy

## Supported versions

The project is in **beta (0.x)**. Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

**Do not open a public issue.** Use **Security → Report a vulnerability** on this repository
(GitHub private vulnerability reporting). Include the affected file or command, the steps to reproduce
and the impact. You will get an answer within 7 days. Reports in English or Spanish are welcome.

## Trust model: what the kit runs on your machine

`training build` is a build tool, like `npm run`. **Only run it on projects you trust.**

- `training.config.json` (`setup`, `server.command`, `beforeLesson`) and the `run` capture steps execute
  **shell commands** on your machine.
- `eval` capture steps execute JavaScript inside the headless browser, and `goto` opens any URL the script names.
- Video scripts and tours are content written by the app's developers. The browser component renders
  every text as plain text, never as HTML.

Before running `training build` on a project someone else wrote, read its `training.config.json` and
the `capture` steps of each `*.script.json`.

## Data

Capture only **fictitious data** from an isolated demo database. Screenshots and videos end up in your
app's repository and in front of its users: never record production data, real people or credentials.
