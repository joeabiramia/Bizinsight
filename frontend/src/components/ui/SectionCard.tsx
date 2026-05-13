import { motion } from "framer-motion";
import type { PropsWithChildren, ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
  animate?: boolean;
  index?: number;
}

export default function SectionCard({
  title, description, children, className, actions, animate = true, index = 0,
}: PropsWithChildren<Props>) {
  const content = (
    <section className={`section-card ${className || ""}`}>
      <div className="section-card-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      <div className="section-card-body">{children}</div>
    </section>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      {content}
    </motion.div>
  );
}
