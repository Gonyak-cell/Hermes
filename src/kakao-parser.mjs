export function parseKakaoTalkExport(text, options = {}) {
  const matterId = options.matterId;
  const sourceId = options.sourceId ?? "kakaotalk-export";
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const messages = [];
  let currentDate = options.defaultDate;
  let lastMessage = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const dividerDate = parseDateFromText(line);
    if (/[-=]{3,}/.test(line) && dividerDate) {
      currentDate = dividerDate;
      lastMessage = null;
      continue;
    }

    const bracket = parseBracketLine(line, currentDate);
    const comma = parseCommaLine(line);
    const colon = parseColonLine(line);
    const parsed = bracket ?? comma ?? colon;

    if (parsed) {
      currentDate = parsed.date ?? currentDate;
      lastMessage = {
        id: `KAKAO-${String(messages.length + 1).padStart(4, "0")}`,
        matter_id: matterId,
        source_type: "kakaotalk",
        source_id: sourceId,
        date: parsed.date ?? currentDate,
        author: parsed.author,
        text: parsed.text,
      };
      messages.push(lastMessage);
      continue;
    }

    if (lastMessage) {
      lastMessage.text = `${lastMessage.text}\n${line.trim()}`.trim();
    }
  }

  return messages.filter((message) => message.date && message.text);
}

function parseBracketLine(line, currentDate) {
  const match = line.match(/^\[(?<author>[^\]]+)\]\s*\[(?<ampm>오전|오후|AM|PM|am|pm)?\s*(?<hour>\d{1,2}):(?<minute>\d{2})\]\s*(?<text>.*)$/);
  if (!match || !currentDate) return undefined;
  return {
    date: currentDate,
    author: match.groups.author.trim(),
    text: match.groups.text.trim(),
  };
}

function parseCommaLine(line) {
  const match = line.match(/^(?<date>20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.)\s*(?<ampm>오전|오후|AM|PM|am|pm)?\s*\d{1,2}:\d{2},\s*(?<author>[^:]+)\s*:\s*(?<text>.*)$/);
  if (!match) return undefined;
  return {
    date: parseDateFromText(match.groups.date),
    author: match.groups.author.trim(),
    text: match.groups.text.trim(),
  };
}

function parseColonLine(line) {
  const match = line.match(/^(?<date>20\d{2}-\d{1,2}-\d{1,2})\s+\d{1,2}:\d{2}\s+(?<author>[^:]+):\s*(?<text>.*)$/);
  if (!match) return undefined;
  return {
    date: parseDateFromText(match.groups.date),
    author: match.groups.author.trim(),
    text: match.groups.text.trim(),
  };
}

function parseDateFromText(value) {
  const korean = value.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korean) return formatDate(korean[1], korean[2], korean[3]);

  const dotted = value.match(/(20\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  if (dotted) return formatDate(dotted[1], dotted[2], dotted[3]);

  const iso = value.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return formatDate(iso[1], iso[2], iso[3]);

  return undefined;
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
