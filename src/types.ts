// src/types.ts

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

// One kind of item: a markdown note. A "code item" is a note whose body starts with a fenced block.
export interface Item {
  id: string;
  title: string;
  folderId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}
