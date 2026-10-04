# Checkpoints

One checkpoint per block of the workshop: the repo as it is at the end of that block. If you fell behind, jump to the checkpoint of the block the room has just finished, and you are back in step.

Run this from your repo folder, with the role of that block: `analyst`, `designer`, `developer`, `qa`, `lawyer` or `ops`. It is the same command on every system, and it needs no Git:

```
node tools/checkpoint.mjs developer
```

What it does:

- It brings the files in `site/` to the end of that block.
- It never overwrites your own files: `site/content.json`, `design/brief.md`, `docs/spec.md`, and a privacy page the Lawyer has written for you. If you have no content file, design brief or spec, it puts in the sample person, Ada Example, the default design brief and the sample spec.
- From the Developer's checkpoint on, the site takes the colours and fonts of your design brief once the brief is finished. The rest is the default design.
- The Lawyer's checkpoint writes the privacy page with the name and the email address from your content file, in English.
- Files you added to `site/` yourself, such as fonts or a photo, stay as they are.
- It says in plain words what it kept, what it changed and which role comes next.

Then start a fresh chat and ask for the next role.

Each folder here holds only what its block adds, and its `README.md` says what that is. A checkpoint lays the folders of every block up to its own over each other, in the order of the blocks.
