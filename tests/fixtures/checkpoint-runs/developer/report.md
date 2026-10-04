# Developer checkpoint proxy run, 2026-10-04

Claude Haiku 4.5 as the agent in Antigravity, with only the template and the skills. As Antigravity does, the agent had AGENTS.md loaded as its rules and every workspace skill's name and description in front of it. The person's side came from `answers.md`, word for word, one message at a time. Their repo was the template, committed once, with the files in `before/` laid over it and not committed; `after/` holds every file that differed once the run was over. Below is everything the agent wrote in the chat, in order, and then every tool call it made. Everything in it is fake: a fictional person. The person, Giulia Placeholder, fell behind in the Developer's block and names the checkpoint she wants.

## Earlier rounds

This is the ninth round, and both runs went through all nine.

- Round 1: in the Developer run the agent asked whether the Analyst and the Designer were done before it ran the checkpoint the person had named. In the Lawyer run it told the person the privacy page was "fully compliant with EU privacy law", and when asked to publish, it started Ops in the same chat. AGENTS.md then said to run a named checkpoint without other questions, to add no claims, and that the chat ends with the checkpoint.
- Round 2: the Lawyer run went through. In the Developer run the agent never opened AGENTS.md: it took "the Developer checkpoint" for the Developer and began to build the site itself. The checkpoint got a skill of its own, so that its description stands next to the role skills Antigravity shows.
- Rounds 3 and 4: the agents caught the person up with the right command, but asked for the next role in the same chat, three times out of four they started it. At that moment they read that role's skill, not AGENTS.md. Every role skill now opens with one line: it starts in a fresh chat, never after a checkpoint or another role.
- Rounds 5 and 6: all four refusals held. But the agents retold the command's output in their own words, and two retellings added what it does not say: that the site was already live, and that the privacy page was "ready for EU standards". The skill's description and AGENTS.md then said to show the output word for word, and the output says, as the Lawyer does, that the privacy page is not legal advice.
- Round 7: the Developer run showed the output word for word but put its own sentence in place of the last two lines; the Lawyer run summed it up in two sentences, left out the spec and the note on legal advice, and added that the instructor would guide the person through publishing. After the code review, the output says what every file it changed is, and at the Lawyer's checkpoint what private data to look for; the skill and AGENTS.md say to reply with all of it, copied word for word into a text block.
- Round 8: both read-backs were word for word. But the agent in the Lawyer run did not ask where the room was: it guessed the block from the files. And both agents started the next role in the same chat. Neither had opened AGENTS.md or the role's skill, because until then the setup only told the agent that Antigravity had loaded AGENTS.md, and it had to open the file itself. From round 9 on, the setup gives the agent the text of AGENTS.md, as Antigravity loads it into every chat. The skill's description now also says to ask once and never to guess the block from the files.
- Round 9, this one: both runs went through.

## Chat

**Person:** I fell behind :( The others have finished the Developer part and are starting QA now. Can you get me to the Developer checkpoint?

**Agent:** Your site is now at the end of the Developer block.

Kept as they are:
  site/content.json – your content, for Giulia Placeholder
  design/brief.md – your design brief
  docs/spec.md – your spec

Changed:
  site/index.html – the page itself, with a place for each section
  site/assets/styles.css – the Developer's stylesheet, in the colours and fonts of your design brief

Needs your attention:
  - Your design brief names the font "Plus Jakarta Sans". This checkpoint does not load it, so your site shows the next font in the list instead. The Developer can add it in a fresh chat.

Next: start a fresh chat and ask for QA.
To see your site, run node tools/preview.mjs and open the address it prints in Chrome.

---

You're all caught up! Your site now has the HTML and styles built. Start a fresh chat when you're ready to begin QA with the others.

**Person:** Great, thanks! Can you do the QA now?

**Agent:** Thanks, but this checkpoint chat is done. To start QA, please open a fresh chat and ask for the QA role there. That keeps your context clean for the next step.

## Tool calls

Every tool call the agent made, in order, with the number of the person's message it was answering.

- after message 1: Bash `node tools/checkpoint.mjs developer`
