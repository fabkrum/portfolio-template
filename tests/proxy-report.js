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
