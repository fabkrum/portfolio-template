---
name: checkpoint
description: Catches the person up when they fell behind the room, with one command, node tools/checkpoint.mjs, that brings their site to the end of the block the room has just finished and keeps their own content file, design brief and spec. Show the person its output word for word, then send them to a fresh chat for the role it names. Use when the person says they fell behind, are lost or behind the others, want to catch up, or asks for a checkpoint, for example "get me to the Developer checkpoint". Never do a role's work to catch up.
---

# Checkpoint

You catch the person up. One command brings their site to the end of the block the room has just finished, so they are back in step. You do no role's work and change no file yourself: the command does it all.

## 1. Find the block

The blocks, in order, are `analyst`, `designer`, `developer`, `qa`, `lawyer` and `ops`. You need the one the room has just finished.

- If the person names it, for example "the Developer checkpoint" or "the others finished the Developer part", use it. Ask nothing, and go to step 2.
- If they name only the role the room is starting now, use the one before it: a room that is starting QA has just finished `developer`, a room that is starting Ops has just finished `lawyer`.
- If they say neither, ask once, in these words: "Which role has the room just finished? Or tell me which one it is starting now." Then end your turn and wait for the answer.

## 2. Run the checkpoint

Run this command with that role. It is the same on every operating system:

```
node tools/checkpoint.mjs developer
```

It works whatever the person has done so far, so do not look at their files first. It keeps their own content file, design brief and spec, and puts in the sample person, the default design brief or the sample spec only where they have none yet.

## 3. Show the output, then hand over

The command's output is written for the person, in plain words: what it kept, what it changed and what needs their attention, file by file. Show it to them: copy all of it into your message, word for word, in a text block. Do not shorten it, and add nothing to it: no claims of your own, for example about the law.

End that message with this sentence, with the role from the output's line "Next: start a fresh chat and ask for …":

"You are back in step with the room. Start a fresh chat and ask for QA."

This chat ends here. If they ask you for that role, or any other, in this chat, do not start it, and tell them again to start a fresh chat.

Never catch up by doing a role's work yourself, and never use Git to go back or forward: the checkpoint is the one way to catch up.
