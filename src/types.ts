// src/types.ts

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

// What an item is, derived from its text: "code" starts with a fenced block, "todo" starts with a
// task (see lib/utils itemKind). All are plain markdown notes on disk.
export type ItemKind = "note" | "code" | "todo";
export type TypeFilter = "all" | ItemKind;

// One kind of item: a markdown note.
export interface Item {
  id: string;
  title: string;
  folderId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}
