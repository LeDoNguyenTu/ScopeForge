import type { LucideIcon } from "lucide-react";

export default function AdminMetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <article className="adminMetricCard">
      <div className="adminMetricLabel">
        <span>{label}</span>
        <span className="adminMetricIcon" aria-hidden="true"><Icon size={16} /></span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
