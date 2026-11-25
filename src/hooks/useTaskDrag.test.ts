// src/hooks/useTaskDrag.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { AT_REST, type DragSource, type DragView } from "../lib/dragStore";
import { parseIndex } from "../lib/taskStore";
import { taskDragOver } from "./useTaskDrag";

const index = parseIndex({
  groups: [{ id: "g1", name: "Work" }],
  lists: [
    { id: "tasks", name: "Tasks" },
    { id: "l1", name: "Home", groupId: "g1" },
  ],
});
const view = (source: DragSource, overId: DragView["overId"]): DragView => ({
  source,
  overId,
});
const task: DragSource = { kind: "task", id: "t", label: "t" };
const list: DragSource = { kind: "taskList", id: "l1", label: "Home" };

test("a dragged task lights the list it is over, and nothing else", () => {
  assert.equal(taskDragOver(view(task, "l1"), index), "l1");
  assert.equal(taskDragOver(view(task, "g1"), index), undefined); // a group takes lists, not tasks
  assert.equal(taskDragOver(view(task, null), index), undefined);
  assert.equal(taskDragOver(view(task, undefined), index), undefined);
});

test("a dragged list lights a group, or the area outside every group", () => {
  assert.equal(taskDragOver(view(list, "g1"), index), "g1");
  assert.equal(taskDragOver(view(list, null), index), null);
  assert.equal(taskDragOver(view(list, "tasks"), index), undefined); // a list does not go onto a list
  assert.equal(taskDragOver(view(list, undefined), index), undefined);
});

test("nothing is lit with no drag, or for a drag of another kind", () => {
  assert.equal(taskDragOver(AT_REST, index), undefined);
  const note: DragSource = { kind: "item", id: "n", label: "n" };
  assert.equal(taskDragOver(view(note, null), index), undefined);
  const group: DragSource = { kind: "taskGroup", id: "g1", label: "Work" };
  assert.equal(taskDragOver(view(group, "g1"), index), undefined);
});
