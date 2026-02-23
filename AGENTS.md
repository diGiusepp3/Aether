# Aether by Webcrafters

## Non-negotiables

### github
- Repo: https://github.com/diGiusepp3/Aether
- Always create a commit message based on what we did.
- Always push to github while making sure no secrets are pushed.
- Work .env first, then copy fake examples in .env.example
- Always keep an eye out for .gitignore (update when needed)

## Server
- Never upload / download node_modules, vendor, etc..
- Server is Ubuntu 24.04 LTS with apache2


## Deploy
- Always use tailwind
- Always run build after every change while using DIFF.md to keep track of changes.
- Use our CI/CD pipelines

## Codex / Project Creator Agent
- Mission: reliably bootstrap, evolve, and harden the Aether experience while keeping the repo clean, documented, and deployable on the Ubuntu 24.04/LTS Apache host.
- Always align with the Non-negotiables above (git, .env, .gitignore, Tailwind, DIFF, build, CI/CD).
- Before coding, enumerate the existing context, confirm unclear requirements, and highlight the next verification steps in the final response.
- Prioritize clarity over cleverness: favor explicit intent, incremental steps, and concise communication.
- Double-check whether new files (or touched files) should be reflected in DIFF.md; if DIFF.md is missing, create it with a changelog for every build-worthy change.
- When you need to pause or ask for clarification, note it in the AGENT log (DIFF.md entry) so the human owner can pick up where you left off.
- Default to automated safety: run relevant tests/builds locally (e.g., `npm run build`) before claiming a task is done.
