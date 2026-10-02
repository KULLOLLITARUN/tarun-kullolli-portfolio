export default function SectionHead({ index, kicker, title, id, children }) {
  return (
    <header className="section-head">
      <p className="kicker mono">
        {index} / {kicker}
      </p>
      <h2 id={id}>{title}</h2>
      {children && <p className="section-lede">{children}</p>}
    </header>
  )
}
