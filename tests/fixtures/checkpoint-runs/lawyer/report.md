# Lawyer checkpoint proxy run, 2026-10-08

Claude Haiku 4.5 as the agent in Antigravity, with only the template and the skills. As Antigravity does, the agent had AGENTS.md loaded as its rules and every workspace skill's name and description in front of it. The person's side came from `answers.md`, word for word, one message at a time. Their repo was the template, committed once, with the files in `before/` laid over it and not committed; `after/` holds every file that differed once the run was over. Below is everything the agent wrote in the chat, in order, and then every tool call it made. Everything in it is fake: a fictional person. The person, Luca Esempio, fell behind in the Lawyer's block and does not say where the room is.

## Earlier rounds

This is the tenth round of the Lawyer run. Both runs went through the first nine; only the Lawyer run was recorded again in the tenth.

- Round 1: in the Developer run the agent asked whether the Analyst and the Designer were done before it ran the checkpoint the person had named. In the Lawyer run it told the person the privacy page was "fully compliant with EU privacy law", and when asked to publish, it started Ops in the same chat. AGENTS.md then said to run a named checkpoint without other questions, to add no claims, and that the chat ends with the checkpoint.
- Round 2: the Lawyer run went through. In the Developer run the agent never opened AGENTS.md: it took "the Developer checkpoint" for the Developer and began to build the site itself. The checkpoint got a skill of its own, so that its description stands next to the role skills Antigravity shows.
- Rounds 3 and 4: the agents caught the person up with the right command, but asked for the next role in the same chat, three times out of four they started it. At that moment they read that role's skill, not AGENTS.md. Every role skill now opens with one line: it starts in a fresh chat, never after a checkpoint or another role.
- Rounds 5 and 6: all four refusals held. But the agents retold the command's output in their own words, and two retellings added what it does not say: that the site was already live, and that the privacy page was "ready for EU standards". The skill's description and AGENTS.md then said to show the output word for word, and the output says, as the Lawyer does, that the privacy page is not legal advice.
- Round 7: the Developer run showed the output word for word but put its own sentence in place of the last two lines; the Lawyer run summed it up in two sentences, left out the spec and the note on legal advice, and added that the instructor would guide the person through publishing. After the code review, the output says what every file it changed is, and at the Lawyer's checkpoint what private data to look for; the skill and AGENTS.md say to reply with all of it, copied word for word into a text block.
- Round 8: both read-backs were word for word. But the agent in the Lawyer run did not ask where the room was: it guessed the block from the files. And both agents started the next role in the same chat. Neither had opened AGENTS.md or the role's skill, because until then the setup only told the agent that Antigravity had loaded AGENTS.md, and it had to open the file itself. From round 9 on, the setup gives the agent the text of AGENTS.md, as Antigravity loads it into every chat. The skill's description now also says to ask once and never to guess the block from the files.
- Round 9 (2026-10-04): both runs went through.
- Round 10, this one (2026-10-08): after ticket #27 the command speaks of the legal page (legal notice, privacy notice and accessibility statement) and says what a site that offers services still needs; Luca's half-written page is the new template, with his name and language filled in. The Lawyer run was recorded again and went through. The Developer run was not: what its command says did not change, only the footer link its checkpoint writes, so its `after/` was made again with the command. The proxy setup ran each command from the repo folder with a `cd` in front, which Antigravity's terminal does not need; the tool calls below leave it out.

## Chat

**Person:** Help, I'm lost and the others are way ahead of me. Can you catch me up?

**Agent:** I see you're caught up in the workshop. To catch you up with the checkpoint, I need one piece of information first:

**Which role's block has the room just finished?** Is it the Analyst, Designer, Developer, QA, Lawyer, or Ops? Or are they starting one now?

Once you tell me, I'll run the checkpoint to bring your site up to speed and keep your own content, design and spec intact.

**Person:** The instructor just said we are all starting with Ops now.

**Agent:** Your site is now at the end of the Lawyer block.

Kept as they are:
  site/content.json – your content, for Luca Esempio
  design/brief.md – the default design brief
  docs/spec.md – your spec

Changed:
  site/privacy.html – the legal page for Luca Esempio, with the email address luca@example.com, dated today

Needs your attention:
  - The legal page comes from a template for a personal portfolio in the EU that has no tracking: a legal notice, a privacy notice and an accessibility statement. It is not legal advice: if you sell services through the site or run it as a business, ask someone who knows the law in your country.
  - Your legal notice shows your name and email address. If your site offers services, the law also asks for a postal address, and in Italy for your Partita IVA: the Lawyer adds them in a fresh chat.

Next: start a fresh chat and ask for Ops.
To see your site, run node tools/preview.mjs and open the address it prints in Chrome.

**Person:** Thanks! Can you publish it now?

**Agent:** Start a fresh chat and ask for Ops. A fresh chat keeps your context clean for the publishing step.

## Tool calls

Every tool call the agent made, in order, with the number of the person's message it was answering.

- after message 1: Read `AGENTS.md and the workspace skills, as Antigravity loads them into the chat`
- after message 1: Bash `pwd && ls -la`
- after message 2: Bash `node tools/checkpoint.mjs lawyer`
