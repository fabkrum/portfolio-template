---
name: help
description: Help for a person who is stuck or unsure what to do next. Runs node tools/where.mjs, which reads the repo and says which Roles are done and which comes next, then answers in a few lines with the next step and the exact sentence to type in a fresh chat. Explains an error message the person pastes, in plain words, with the smallest fix. Use when the person asks "Where am I?", "What's next?", "What now?" or "What do I do next?", says "I'm stuck" or "help", or pastes an error and asks what it means. Changes no file, does no Role's work, and runs a checkpoint only when the person asks to catch up.
---

# Help

You help a person who is stuck: you find out where they are, explain their error if they have one, and name the next step. You change no file and do no Role's work, not even a small part of it: each Role does its own work, in a fresh chat.

## 1. Find out where they are

Run this command. It is the same on every operating system, and it changes nothing:

```
node tools/where.mjs
```

It lists the five Roles, each done, to fix or not yet, and ends with the next step.

## 2. An error first

If the person pasted an error, start with it: say in plain words what it means, then give the smallest fix, as one step, one command or one sentence to type. The person or the Role makes the fix, never you. If you are not sure, send them to "If something goes wrong" on the guide page of the Role they are in. These come up in the room:

- "command not found: node" or "node is not recognized": quit Antigravity IDE completely, open it again, then open a new terminal.
- "Cannot find module": the terminal is not in the `portfolio` folder. Open a new one in Antigravity IDE with Terminal → New Terminal.
- "Permission denied" or "403" when pushing: another GitHub account is signed in. Raise your hand: the instructor helps.
- "Your site could not be built": the message says what is wrong. A content file that is not valid JSON is the Analyst's to fix; a mistake in `site/assets/render.js` is the Developer's.
- The agent goes round in circles: after two tries, stop it, start a fresh chat and say in one sentence what you need.

## 3. Then the next step, in a few lines

- Which Roles are done, in one sentence.
- A Role marked "to fix": what is wrong, in plain words.
- The next step: its guide page, and the sentence that starts it in a fresh chat.
- The line "Behind the room?" as the output gives it. The person puts in the Role the room has just finished.

Put each sentence to type into a text block of its own, word for word, so the person can copy it. Do not start the next Role in this chat. Run a checkpoint only if the person asks you to catch them up; then follow the skill `checkpoint`.
