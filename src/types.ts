// src/types.ts

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  /** Rank in a chosen order among its siblings (see lib/order); none until it is put somewhere. */
  order?: number;
}

// What an item is, derived from its text: "code" starts with a fenced block (see lib/utils itemKind).
// Both are plain markdown notes on disk.
export type ItemKind = "note" | "code";

// One kind of item: a markdown note.
export interface Item {
  id: string;
  title: string;
  folderId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** Rank in a chosen order among the notes of its folder (see lib/order); none until it is put somewhere. */
  order?: number;
  /**
   * Set while the text has not been read yet (the startup scan lists notes without it): `body` is "" and `kind` is
   * what the scan saw. Such a note must never be written, or its file would become an empty note: storage refuses
   * it, and the hooks read the text first. Absent means `body` is the text of the note.
   */
  unloaded?: { kind: ItemKind };
}
