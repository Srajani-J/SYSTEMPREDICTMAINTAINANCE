function SectionCard({ title, description, actions, children, className = "" }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      {(title || actions) && (
        <header className="section-head">
          <div>
            {title ? <h2 className="section-title">{title}</h2> : null}
            {description ? (
              <p className="section-description">{description}</p>
            ) : null}
          </div>

          {actions ? <div className="section-actions">{actions}</div> : null}
        </header>
      )}

      {children}
    </section>
  );
}

export default SectionCard;
