export type Source = {
  id: string;
  documentId: string;
  title: string;
  section: string;
  pageStart?: number;
  pageEnd?: number;
  distance: number;
};

export type ChatEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};
