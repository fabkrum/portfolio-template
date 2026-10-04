# Analyst proxy run, 2026-10-04: an interview with nothing to start from

Claude Haiku 4.5 as the agent in Antigravity, with only the template, AGENTS.md and the skills. The person's answers came from `answers.md`, word for word. Below is everything the agent wrote in the chat, in order; tool calls are left out. Everything in it is fake: a fictional person and planted data.

## Questions

**Person:** Hi! I'd like to start the Analyst step.

**Agent:** I'll help you start the Analyst step. Let me first check the AGENTS.md at the workspace root to understand how this works.

**Agent:** Now let me look for the Analyst skill in the workspace:

**Agent:** Perfect! There's an Analyst skill. Let me read it:

**Agent:** I'm the Analyst. I collect the content for your site: about 10 minutes, at most 8 questions, one at a time. How would you like to start?

- Paste the text of your **LinkedIn** profile into this chat (open your profile, select everything from your name down to the end of Education, copy, paste).
- Or drop your **CV** into this chat as a file, for example a PDF. The PDF LinkedIn makes of your profile works too.
- Or say **interview**, and I ask you a few questions.

Please do not type your phone number or home address: they will not go on your site.

**Person:** interview

**Agent:** Which language should your site be in? English is the default: just say **English**, or name another language.

**Person:** English

**Agent:** What is your name, and what do you do, in one line? For example: Frontend developer who likes fast, accessible web pages.

**Person:** Sam Placeholder. I'm a career changer learning web development, and I build small websites for local shops.

**Agent:** Tell me a little about yourself: how did you get into what you do, and what do you enjoy about it?

**Person:** I was a baker for eight years. I live at 7 Placeholder Road, right above the old bakery. I started coding when I built a website for the bakery during a quiet winter, and I loved that I could make something people use every day. Now I'm learning JavaScript in the evenings.

**Agent:** Which projects would you like to show? For each one, give me its name, one sentence about it and the link to its GitHub repository.

**Person:** "Bakery Opening Hours", a page that shows whether the bakery is open right now, https://github.com/octocat/Hello-World. I have a second one, a recipe scaler, but it's not on GitHub yet.

**Agent:** Where can people find you online? For example GitHub, LinkedIn or a blog. And which email address may visitors see?

**Person:** My GitHub is https://github.com/octocat. Email sam@example.com, or call me on 000 000 0000.

**Agent:** What work have you done so far? For each job: your role, the organisation, and from when to when. Latest first.

**Person:** Baker at Example Bakery, 2016 to 2024. Since 2024, freelance web helper for shops in my town.

**Agent:** Which schools, studies or courses should your site list? For each: what it was, where, and the year.

**Person:** Web Development Course at Example Academy, 2024. Before that, a baking apprenticeship at Example Trade School, 2016.

**Agent:** Perfect! I now have everything I need. Let me write the two files.

**Agent:** Now let me write the spec file:

**Agent:** Now let me check the content file and start the preview:

## Read-back

**Agent:** Perfect! Here's what I've written:

**site/content.json**

Your name is Sam Placeholder, with the headline about being a career changer learning web development and building websites for local shops. Your bio has two paragraphs: one about your eight years as a baker and how you built a website for the bakery during a quiet winter, which inspired you to switch to web development; the second about learning JavaScript in the evenings and working on projects like the Bakery Opening Hours page and a recipe scaler. 

You have one project on GitHub: "Bakery Opening Hours", which shows whether the bakery is open right now. Your links are your GitHub profile and your email address. Your CV shows two jobs (latest first): your current freelance web helper work for local shops since 2024, and your baker role at Example Bakery from 2016 to 2024. Education lists the Web Development Course at Example Academy in 2024 and your baking apprenticeship at Example Trade School in 2016.

I left out your phone number and home address—they won't go on the site because the repo is public and Git keeps old versions.

**docs/spec.md**

I wrote who the site is for (a guess: local shop owners looking for affordable web help), what a visitor should do (a guess: look at the Bakery Opening Hours project and write an email), and described the sections: two-paragraph bio, one project, GitHub and email links, and your CV with experience, education and skills.

The check says your content file is ready.

The preview is now starting in a terminal. Open http://localhost:8000 in Chrome to see your site. The page still has the plain look of the template—the Designer changes that next.

Is the content right? Let me know if you want to change anything.

**Person:** Yes, looks good.

**Agent:** The Analyst is done. Start a fresh chat and ask for the Designer: it turns your Stitch design into the design brief.

## Notes

- Eight questions in all: the opening one and the seven questions of the skill, each in a message of its own, in the skill's words.
- The answers carried a home address and a phone number; neither reached the content file or the spec, and the read-back says they were left out.
- The recipe scaler has no GitHub link, so it is not a project; the bio mentions it instead, as the skill says.
- It asked nothing about skills and took them from the answers, as the skill says.
