import ScopeForgeMark from "@/components/brand/ScopeForgeMark";

export default function ScopeForgeWordmark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const classes = ["scopeforgeWordmark", compact ? "scopeforgeWordmarkCompact" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <ScopeForgeMark size={compact ? 30 : 34} />
      <span className="scopeforgeWordmarkText">ScopeForge</span>
    </span>
  );
}
