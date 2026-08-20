export interface IcsEventInput {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string;
  end?: string | null;
  url?: string | null;
}

function toIcsDate(iso: string): string {
  return `${new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildIcsContent(event: IcsEventInput): string {
  const start = toIcsDate(event.start);
  const end = toIcsDate(
    event.end ?? new Date(new Date(event.start).getTime() + 60 * 60 * 1000).toISOString(),
  );
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NEAR Builders//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcsFile(event: IcsEventInput) {
  const content = buildIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${event.uid || "event"}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
