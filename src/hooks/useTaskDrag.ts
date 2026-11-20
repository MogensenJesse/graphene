// src/hooks/useTaskDrag.ts
// What dropping a dragged task, to-do list or group comes to. The drag itself is the notes' (useDragToFolder);
// the rows carry data-sort-kind "task" | "taskList" | "taskGroup" and the sidebar's lists and groups are drop targets.
import { placeNear } from "../lib/order";
import {
  compareTasks,
  sortedGroups,
  sortedLists,
  type Task,
  type TaskGroup,
  type TaskList,
} from "../lib/taskStore";
import { useDragToFolder } from "./useDragToFolder";
import type { TasksApi } from "./useTasks";

export function useTaskDrag(api: TasksApi) {
  const { dragState, dragOverId, startDrag } = useDragToFolder(
    (source, target, near) => {
      const { index, tasks } = api;
      const listOf = (taskId: string) =>
        Object.keys(tasks).find((id) => tasks[id].some((t) => t.id === taskId));

      if (source.kind === "task") {
        if (near) {
          // Next to another task of the list's own view: the open ones, in the order shown
          const listId = listOf(near.id);
          if (!listId) return;
          const shown = tasks[listId].filter((t) => !t.done).sort(compareTasks);
          api.rankTasks(
            listId,
            placeNear(shown, source.id, near.id, near.after),
          );
        } else if (
          typeof target === "string" &&
          index.lists.some((l) => l.id === target)
        ) {
          const from = listOf(source.id);
          if (from) api.moveTask(from, target, source.id);
        }
      } else if (source.kind === "taskList") {
        const moved = index.lists.find((l) => l.id === source.id);
        if (!moved) return;
        if (near) {
          // Next to another list: it takes that list's group
          const anchor = index.lists.find((l) => l.id === near.id);
          if (!anchor) return;
          const groupId = anchor.groupId ?? null;
          const ranks = placeNear(
            sortedLists(index, groupId),
            source.id,
            near.id,
            near.after,
          );
          if ((moved.groupId ?? null) !== groupId)
            api.updateList(source.id, { groupId });
          api.rankLists(ranks);
        } else if (
          target === null ||
          (typeof target === "string" &&
            index.groups.some((g) => g.id === target))
        ) {
          // On a group: into it. On the empty space of the lists: out of its group.
          api.updateList(source.id, { groupId: target });
        }
      } else if (source.kind === "taskGroup" && near) {
        api.rankGroups(
          placeNear(sortedGroups(index), source.id, near.id, near.after),
        );
      }
    },
  );

  // Only what a drop would do is lit: a task goes onto a list, a list onto a group or out of one
  const over =
    dragState?.kind === "task"
      ? typeof dragOverId === "string" &&
        api.index.lists.some((l) => l.id === dragOverId)
        ? dragOverId
        : undefined
      : dragState?.kind === "taskList"
        ? dragOverId === null ||
          (typeof dragOverId === "string" &&
            api.index.groups.some((g) => g.id === dragOverId))
          ? dragOverId
          : undefined
        : undefined;

  return {
    dragState,
    dragOverId: over,
    startTask: (e: React.PointerEvent, task: Task) =>
      startDrag(e, { kind: "task", id: task.id, label: task.title }),
    startList: (e: React.PointerEvent, list: TaskList) =>
      startDrag(e, { kind: "taskList", id: list.id, label: list.name }),
    startGroup: (e: React.PointerEvent, group: TaskGroup) =>
      startDrag(e, {
        kind: "taskGroup",
        id: group.id,
        label: group.name,
        parent: "",
      }),
  };
}
