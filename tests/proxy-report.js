// Reads the report.md of a proxy run: everything the person and the agent
// wrote, as turns. See fixtures/README.md.

// The turns in the report's section with this heading, such as "Questions",
// as { who: "Agent" | "Person", text }; null when there is no such section.
export function turnsIn(report, heading) {
  const section = report.split(/^## /m).find((part) => part.startsWith(heading));
  if (section === undefined) return null;
  const pieces = section.split(/^\*\*(Agent|Person):\*\*/m).slice(1);
  const turns = [];
  for (let index = 0; index < pieces.length; index += 2) turns.push({ who: pieces[index], text: pieces[index + 1].trim() });
  return turns;
}

// How many of the person's messages answer a question: all of them after the
// agent's first message. The person's first message opens the chat.
export const answerCount = (turns) =>
  turns.slice(turns.findIndex((turn) => turn.who === "Agent")).filter((turn) => turn.who === "Person").length;

// Everything the agent wrote in these turns, as one text.
export const agentText = (turns) =>
  turns
    .filter((turn) => turn.who === "Agent")
    .map((turn) => turn.text)
    .join("\n");

// The tool calls in the report's "Tool calls" section, as { after, call },
// such as { after: 2, call: "Bash `node tools/check.mjs`" }: "after" is the
// number of the person's message the agent was answering. Null when the
// report has no such section.
export function toolCallsIn(report) {
  const section = report.split(/^## /m).find((part) => part.startsWith("Tool calls"));
  if (section === undefined) return null;
  return [...section.matchAll(/^- after message (\d+): (.+)$/gm)].map(([, after, call]) => ({ after: Number(after), call }));
}
