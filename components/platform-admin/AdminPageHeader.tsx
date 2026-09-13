import type { ReactNode } from "react";

export default function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="adminPageHeader">
      <div className="adminPageHeaderCopy">
        <span className="adminEyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="adminPageHeaderActions">{actions}</div> : null}
    </header>
  );
}
