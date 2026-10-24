import type { MinuteDocument } from "./minute-rich-editor";

export type Minute = {
  id: string;
  title: string;
  date: string;
  summary: string;
  attendees: string | null;
  decisions: string | null;
  followUps: string | null;
  content: MinuteDocument | null;
  archivedAt: string | null;
  _count?: { attachments: number };
};

export const minuteText = (content: MinuteDocument): string => {
  const parts: string[] = [];
  const walk = (node: MinuteDocument) => {
    if (node.type === "text" && node.text) parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(content);
  return parts.join(" ").replace(/\s+/g, " ").trim();
};
