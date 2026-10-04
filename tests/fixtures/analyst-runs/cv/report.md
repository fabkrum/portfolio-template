# Analyst proxy run, 2026-10-04: a CV as a PDF

Claude Haiku 4.5 as the agent in Antigravity, with only the template, AGENTS.md and the skills. The person's answers came from `answers.md`, word for word. Below is everything the agent wrote in the chat, in order; tool calls are left out. Everything in it is fake: a fictional person and planted data.

## Questions

**Person:** Hi! I'd like to start the Analyst step.

**Agent:** I'm the Analyst. I collect the content for your site: about 10 minutes, at most 8 questions, one at a time. How would you like to start?

- Paste the text of your **LinkedIn** profile into this chat (open your profile, select everything from your name down to the end of Education, copy, paste).
- Or drop your **CV** into this chat as a file, for example a PDF. The PDF LinkedIn makes of your profile works too.
- Or say **interview**, and I ask you a few questions.

Please do not type your phone number or home address: they will not go on your site.

**Person:** Here's my CV. (drops `cv.pdf` into the chat)

**Agent:** Got it. I've read your CV. Here's what I found:

**What I have**: Your name (Giulia Placeholder), what you do (Data analyst who builds web dashboards), your profile, two jobs, one project with a GitHub link, education, and skills.

**What I left out**: your phone number, home address, and date of birth. These won't go on the site because the folder is public and Git keeps old versions.

**What I'm missing**: the site language, your email address, and any other links where people can find you (LinkedIn, blog, portfolio, etc.).

Now I'll ask the questions I need to fill the gaps. Here's the first one:

**Which language should your site be in? English is the default: just say English, or name another language.**

**Person:** Italian, please.

**Agent:** Perfetto. The site will be in Italian.

**Where can people find you online? For example GitHub, LinkedIn or a blog. And which email address may visitors see?**

**Person:** giulia@example.com is the one to show.

**Agent:** Perfetto. I have everything I need now.

Let me write the two files: the content file and the spec.

## Read-back

**Agent:** Perfetto. Here's what I wrote:

**site/content.json**: Giulia Placeholder, data analyst who builds web dashboards. Bio in two paragraphs about her journey from spreadsheets to dashboards. One project: Delivery Dashboard with a GitHub link. Links to her GitHub profile and email (giulia@example.com). CV with two jobs (Data Analyst at Example Logistics since 2022, Junior Analyst at Placeholder Bank 2020–2022), two education entries (MSc Statistics 2020, Frontend Course 2023), and five skills. All in Italian.

**docs/spec.md**: The site is for companies and teams looking for a data analyst (my guess). Visitors should look at the projects on GitHub and then email her. One project, two bio paragraphs, GitHub and email links, full CV with skills.

**The check**: site/content.json is ready. No problems.

Now let me start the preview so you can see it on the page:

```
node tools/preview.mjs
```

The preview is running at http://localhost:8000. Open that address in Chrome and let me know if the content looks right.

**Person:** Yes, looks good.

**Agent:** The Analyst is done. Start a fresh chat and ask for the Designer: it turns your Stitch design into the design brief.

## Notes

- Three questions in all, the opening one included: how to start, the language and the email address. The CV had the name, the bio, the work, the education, one project and the GitHub profile.
- It left out the phone number, the street address with its postcode and the date of birth, and said so once.
- The site is in Italian: the bio, the headline, the summaries, "oggi" for the end date and the page's own words in `labels`. Some job and degree titles and one skill stayed in English (Data Analyst, MSc Statistics, Frontend Course, Data visualisation); they read as names, not as untranslated text.
- The CV was dropped from outside the repo folder, and the agent rightly said nothing about moving it.
- Local ports cannot be opened in the proxy run, so the agent was told to treat the preview as started.
