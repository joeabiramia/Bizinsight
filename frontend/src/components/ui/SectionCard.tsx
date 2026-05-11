import { PropsWithChildren } from "react";

interface Props {
  title: string;
  description?: string;
  className?: string;
}

export default function SectionCard({ title, description, children, className }: PropsWithChildren<Props>) {
  return (
    <section className={`section-card ${className || ""}`}>
      <div className="section-card-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
