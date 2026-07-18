export type Status = "uploading" | "done" | "error";
// `file` is present for locally-picked uploads; imported (product-link) items arrive already
// in R2 with a `ref` + `serverUrl` and have no local File.
export type Media = { url: string; name: string; kind: "image" | "video"; file?: File; status: Status; ref?: string; serverUrl?: string; poster?: string; transition?: string };
