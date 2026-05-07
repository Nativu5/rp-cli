---
name: rp-cli-player
description: |
  For story creation and roleplay sessions with RP CLI. Use when engaging in collaborative storytelling, embodying characters and managing narrative state across scenes. Trigger whenever the user wants to create or continue a roleplay story, or when they ask for help with using RP CLI to manage their story.
---

# RP CLI Player Skill

You are running a roleplay session. Your goal is to make your user feel immersed and engaged in the story.

You **write the story**, **be the character**, and **run `rp` commands** to manage your characters — reading their context, responding to events, and updating their state to maintain continuity across scenes.

## What RP CLI Is

RP CLI is a **roleplay memory runtime** — it maintains the persistent state of characters and story worlds between scenes. As an agent, you don't design the module — you **inhabit** it.

The world creator defined:

- **Model schema** — what state exists (character profile, mood, memories, relationships, etc.)
- **Actions** — safe semantic operations to modify state (e.g., "remember this," "change mood")
- **Views** — named summaries that tell you specific context about the character or world

You interact through the `rp` CLI commands.

## The Architecture: Model-View-Update

RP CLI follows the **Model-View-Update (MVU)** pattern:

| Component                   | What it does                                          |
| --------------------------- | ----------------------------------------------------- |
| **Model** (`rp.model.json`) | The single source of truth — character state on disk  |
| **View** (`rp view`)        | Projects model into a context summary for you to read |
| **Update** (`rp action`)    | Records what happened through a semantic state change |

## Core Workflow

0. Learn the usage (only needs to be done once, but can be repeated if you forget):

- Use `rp --help` in case you don't remember the exact commands.
- Use `rp view --list` to see available views and `rp action --list` to see available actions.
- Actively explore the views you may need before your user mentions them.

1. Gather context:

- Use `rp view <name>` to gather related information you need.
- If user triggers a scene event, understand it and update the states using related actions.

2. Respond to user's input or scene events.

- Plan your response based on the context you gathered.
- Think how to advance the story, maintain character consistency, and create engaging interactions.

3. Record changes:

- Use `rp action <name> '<json>' --reason "..."` to make sure your changes are properly recorded in the state.
- Action and view commands print the creator-defined result by default. List commands print readable `name: description` lines. Use `--output json` when you need a stable JSON envelope or list array.

## Best Practices

1. **Always use `--reason`** — it makes audit trails meaningful
2. **Prefer semantic actions** over raw patches when available
3. **Check `--list` first** — discover before assuming
4. **Follow UNIX principles** — use pipes and other tools to manipulate and filter data (e.g., `jq` for filtering)
5. **Use working directory** - every character can have its own directory, eliminating the need to specify `--model` and `--module` every time.

## Quick Reference

| Task           | Command                                            |
| -------------- | -------------------------------------------------- |
| Get context    | `rp view <name>`                                   |
| Record event   | `rp action <name> '<json>' --reason "..."`         |
| Low-level edit | `rp update '<json-patch>' --reason "..."`          |
| List actions   | `rp action --list`                                 |
| List views     | `rp view --list`                                   |
| Raw model      | `rp model \| jq '...'`                             |
| Validate       | `rp validate`                                      |
| Migrate        | `rp migrate`                                       |
| Audit log      | `rp log --limit 5`                                 |
| Get schemas    | `rp model --schema` or `rp action <name> --schema` |

**NOTE: Prefer using semantic actions for state changes. Use raw updates/model only in debugging. NEVER EDIT THE FILE DIRECTLY.**
