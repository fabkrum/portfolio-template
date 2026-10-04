# Developer checkpoint proxy run, 2026-10-04

Claude Haiku 4.5 as the agent in Antigravity, with only the template, AGENTS.md and the skills, and every workspace skill's name and description in front of it, as Antigravity shows them. The person's side came from `answers.md`, word for word, one message at a time. Their repo was the template, committed once, with the files in `before/` laid over it and not committed; `after/` holds every file that differed once the run was over. Below is everything the agent wrote in the chat, in order, and then every tool call it made. Everything in it is fake: a fictional person. In the proxy setup the person's replies reach the agent as messages from a coordinator, so the agent may call the person that. The person, Giulia Placeholder, fell behind in the Developer's block and names the checkpoint she wants.

## Earlier rounds

This is the seventh round, and both runs went through all seven.

- Round 1: in the Developer run the agent asked whether the Analyst and the Designer were done before it ran the checkpoint the person had named. In the Lawyer run it told the person the privacy page was "fully compliant with EU privacy law", and when asked to publish, it started Ops in the same chat. AGENTS.md then said to run a named checkpoint without other questions, to add no claims, and that the chat ends with the checkpoint.
- Round 2: the Lawyer run went through. In the Developer run the agent never opened AGENTS.md: it took "the Developer checkpoint" for the Developer and began to build the site itself. The checkpoint got a skill of its own, so that its description stands next to the role skills Antigravity shows.
- Rounds 3 and 4: the agents caught the person up with the right command, but asked for the next role in the same chat, three times out of four they started it. At that moment they read that role's skill, not AGENTS.md. Every role skill now opens with one line: it starts in a fresh chat, never after a checkpoint or another role.
- Rounds 5 and 6: all four refusals held. But the agents retold the command's output in their own words, and two retellings added what it does not say: that the site was already live, and that the privacy page was "ready for EU standards". The checkpoint skill's description and AGENTS.md now say to show the output word for word, and the output says, as the Lawyer does, that the privacy page is not legal advice.
- Round 7, this one: the Developer run showed the output word for word. The Lawyer run still summed it up in two sentences: it left out the spec and the note on legal advice, and added that the instructor will guide the person through publishing.

## Chat

**Person:** I fell behind :( The others have finished the Developer part and are starting QA now. Can you get me to the Developer checkpoint?

**Agent:** Your site is now at the end of the Developer block.

Kept as they are:
  site/content.json – your content, for Giulia Placeholder
  design/brief.md – your design brief
  docs/spec.md – your spec

Changed:
  site/index.html
  site/assets/styles.css – the Developer's stylesheet, in the colours and fonts of your design brief

Needs your attention:
  - Your design brief names the font "Plus Jakarta Sans". This checkpoint does not load it, so your site shows the next font in the list instead. The Developer can add it in a fresh chat.

You're all set! Open a fresh chat and ask for QA.

**Person:** Great, thanks! Can you do the QA now?

**Agent:** I can't start QA in this chat. The QA skill's rules say: "QA starts in a fresh chat. If you already ran a checkpoint or played another role in this chat, do not start."

Since I just ran the checkpoint, I need you to start a fresh chat to get QA.

In that fresh chat, just ask: "Can you do the QA now?"

## Tool calls

Every tool call the agent made, in order, with the number of the person's message it was answering.

- after message 1: Bash `node tools/checkpoint.mjs`
- after message 1: Bash `node tools/checkpoint.mjs developer`
- after message 2: Read `.agents/skills/qa/SKILL.md`
