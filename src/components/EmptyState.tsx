// src/components/EmptyState.tsx

interface EmptyStateProps {
  onNew: () => void;
}

function EmptyState({ onNew }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        ⬡
      </span>
      <div className="empty-state__text">
        <p className="empty-state__title">no snippets yet</p>
        <p className="empty-state__subtitle">
          add your first Webflow code snippet
        </p>
      </div>
      <button
        type="button"
        className="empty-state__btn"
        onClick={onNew}
        aria-label="Add first snippet"
      >
        <span aria-hidden="true">+</span> add snippet
      </button>
    </div>
  );
}

export default EmptyState;
