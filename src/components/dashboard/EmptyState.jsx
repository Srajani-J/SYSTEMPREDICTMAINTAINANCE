function EmptyState({ title = "Nothing to show yet", hint, action }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {hint ? <p>{hint}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
