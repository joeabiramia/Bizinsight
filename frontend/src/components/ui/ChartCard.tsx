import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  index?: number;
}

export default function ChartCard({ title, description, children, actions, className = "", index = 0 }: ChartCardProps) {
  return (
    <motion.div
      className={`section-card ${className}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <div className="section-card-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>{actions}</div>}
      </div>
      <div className="section-card-body">{children}</div>
    </motion.div>
  );
}
