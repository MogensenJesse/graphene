// src/components/EmptyState.tsx

interface EmptyStateProps {
  onNewNote: () => void;
  onNewSnippet: () => void;
}

function EmptyState({ onNewNote, onNewSnippet }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        ⬡
      </span>
      <div className="empty-state__text">
        <p className="empty-state__title">nothing here yet</p>
        <p className="empty-state__subtitle">
          create your first note or snippet
        </p>
      </div>
      <div className="empty-state__actions">
        <button
          type="button"
          className="empty-state__btn"
          onClick={onNewNote}
          aria-label="Add note"
        >
          <span aria-hidden="true">+</span> note
        </button>
        <button
          type="button"
          className="empty-state__btn"
          onClick={onNewSnippet}
          aria-label="Add snippet"
        >
          <span aria-hidden="true">+</span> snippet
        </button>
      </div>
    </div>
  );
}

export default EmptyState;
