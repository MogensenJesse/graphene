// src/components/tasks/AddTask.tsx
import { useEffect, useRef, useState } from "react";
import { dueLabel } from "../../lib/taskDates";
import DatePick from "../ui/DatePick";
import { CalendarIcon, PlusIcon } from "../ui/Icon";

interface AddTaskProps {
  placeholder: string;
  today: string;
  onAdd: (fields: { title: string; due?: string }) => void;
  /** Goes up when something asks for the box to take the focus (Ctrl+N). */
  focusSignal: number;
}

/** One line to type a task in; Enter adds it and keeps the box for the next one. A day can be picked first. */
function AddTask({ placeholder, today, onAdd, focusSignal }: AddTaskProps) {
  const [text, setText] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) input.current?.focus();
  }, [focusSignal]);

  const submit = () => {
    const title = text.trim();
    if (!title) return;
    onAdd(due ? { title, due } : { title });
    setText("");
    setDue(null);
  };

  return (
    <div className="add-task">
      <PlusIcon size={14} />
      <input
        ref={input}
        className="add-task__input"
        type="text"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <DatePick
        value={due ?? ""}
        onChange={setDue}
        label="Due date"
        className={
          due ? "btn btn--primary btn--sm btn--pill" : "icon-btn icon-btn--md"
        }
      >
        {due ? dueLabel(due, today) : <CalendarIcon size={14} />}
      </DatePick>
    </div>
  );
}

export default AddTask;
