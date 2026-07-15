export type Status = "uploading" | "done" | "error";
export type Media = { url: string; name: string; kind: "image" | "video"; file: File; status: Status; ref?: string; serverUrl?: string; poster?: string; transition?: string };
