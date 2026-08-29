---
name: skill-creator
description: Use when the user wants to create, scaffold, or draft a new Claude Code skill — asks to "make a skill", "create a skill for X", "build a SKILL.md", "새 스킬 만들어줘", or discusses turning a repeatable workflow into a reusable skill. Runs a guided Q&A and writes the resulting SKILL.md (and any supporting files) to the right location.
---

# Skill Creator

You are helping the user design and write a new Claude Code skill. Do not skip straight to writing a file — first gather the design decisions below via `AskUserQuestion` (batch related ones together; skip a question only if the user already answered it in conversation). Then write the skill.

Phrase every `AskUserQuestion` question, option label, and option description in Korean (한국어). The skill files you write (SKILL.md, references, etc.) and your other conversational replies stay in whatever language the surrounding conversation uses.

## 1. Gather requirements

Ask (or infer from context) for each of these. Keep it to 2-3 AskUserQuestion calls, grouping related questions.

- **Purpose & name**: What should the skill do, in one sentence? Derive a kebab-case `name` from it (e.g. `db-migration-writer`). Confirm the name isn't already taken — check `~/.claude/skills/<name>/` and `.claude/skills/<name>/` (project) before writing.
- **Scope**: Where does this skill belong?
  - **Personal** (`~/.claude/skills/<name>/SKILL.md`) — useful across all projects. Must be a *direct* child of `~/.claude/skills/` — Claude Code only scans one level deep, so nested subfolders (e.g. a `my-skills/` grouping folder) are silently ignored.
  - **Project** (`.claude/skills/<name>/SKILL.md`) — specific to the current repo/codebase.
  - **Plugin** — only if the user explicitly says they're building a plugin; skills then live under the plugin's `skills/` directory.
- **Trigger conditions**: What phrases or situations should cause this skill to fire? Get concrete example phrases (including non-English ones if relevant) — this becomes the `description` field, which is the *only* thing Claude sees when deciding whether to invoke the skill. A vague description ("helps with testing") triggers unreliably; a description with quoted example phrases and keywords triggers reliably.
- **Who invokes it**:
  - Both user (`/name`) and Claude automatically — default, no extra frontmatter.
  - User only, via `disable-model-invocation: true` — for skills with side effects (deploys, sends messages, destructive ops) that shouldn't fire autonomously.
  - Claude only, via `user-invocable: false` — for background knowledge/conventions the user would never type as a slash command.
- **Isolation**: Should this run inline in the main conversation, or forked into a subagent (`context: fork`, optionally with `agent: <type>`)? Fork when the skill does research/exploration whose raw tool output would just clutter the main context, or when it should run as a background task.
- **Tool restrictions**: Does it need `allowed-tools: Read, Grep, Glob` (read-only) or similar restriction, or is full tool access fine (omit the field)?
- **Supporting files**: Does it need a `references/` (docs Claude reads on demand), `scripts/` (helper shell/python scripts it runs), `examples/`, or `templates/` subdirectory? Ask what belongs in each rather than guessing.
- **Arguments**: Does invocation take free-form input (`$ARGUMENTS`)? If so, what should the user pass?

## 2. Write the description field carefully

This is the highest-leverage part of the whole skill. Follow this shape:

```
Use when <situation/trigger>. Triggers on: "<phrase 1>", "<phrase 2>", <keyword>, <keyword>. <Optional: what it does NOT cover, to avoid overlap with sibling skills.>
```

- Front-load concrete trigger phrases, not abstract category names.
- If this skill could be confused with another existing skill, name the boundary explicitly.
- Keep the rest of the SKILL.md body focused on instructions *for Claude to follow when the skill fires* — not documentation about the skill for a human reader.

## 3. Compose the frontmatter

Only include fields that deviate from defaults:

```yaml
---
name: kebab-case-name
description: <as designed above>
disable-model-invocation: true   # only if user-only
user-invocable: false            # only if Claude-only (mutually exclusive with above)
allowed-tools: Read, Grep, Glob  # only if restricting tools
context: fork                    # only if it should run isolated
agent: Explore                   # only if context: fork and a specific agent type is wanted
---
```

## 4. Write the files

1. Create the directory: `<scope-root>/skills/<name>/` (direct child — no extra nesting for personal skills).
2. Write `SKILL.md` with the frontmatter plus body content structured as: what the skill does, step-by-step instructions for Claude to follow, and links to any supporting files (`[references/x.md](references/x.md)` style — relative links, since these get read on demand rather than loaded upfront).
3. Write any `references/`, `scripts/`, `examples/`, or `templates/` files discussed in step 1. Scripts should be minimal and match the project's existing conventions if any exist.
4. Do not create files nobody asked for — if the user didn't need a `scripts/` dir, don't add one "for completeness."

## 5. Confirm and hand off

After writing, tell the user:
- The exact path(s) written.
- How to invoke it: `/<name>` for manual invocation, or the trigger phrases for automatic invocation.
- That a **new personal or plugin skill typically needs a fresh Claude Code session to be picked up** — project-level skills in an already-open session may also need a reload. Mention this rather than asserting the skill is immediately live.
- Offer to test-invoke it in the current session if the user wants to sanity-check the trigger wording.

## Anti-patterns to avoid

- Don't write a description that just restates the name ("A skill for X") — it won't trigger reliably.
- Don't bundle unrelated capabilities into one skill; suggest splitting into two skills with distinct trigger conditions instead.
- Don't default to `context: fork` — only isolate when there's a concrete reason (noisy tool output, background execution).
- Don't invent scripts/templates the user didn't ask for.
- Don't nest personal skills under a grouping subfolder inside `~/.claude/skills/` — only direct children are discovered.
