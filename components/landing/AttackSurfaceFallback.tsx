import ScopeForgeMark from "@/components/brand/ScopeForgeMark";

const FALLBACK_ARMS = [
  "M50 50 L18 39",
  "M50 50 L31 17",
  "M50 50 L57 12",
  "M50 50 L88 37",
  "M50 50 L79 78",
  "M50 50 L38 86",
] as const;

export default function AttackSurfaceFallback() {
  return (
    <div className="commandSurfaceFallbackLayer" data-testid="attack-surface-fallback" aria-hidden="true">
      <svg className="commandSurfaceFallback" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="12" />
        <circle cx="50" cy="50" r="21" />
        <circle cx="50" cy="50" r="31" strokeDasharray="1.1 1.8" />
        {FALLBACK_ARMS.map((path) => <path d={path} key={path} />)}
        <path d="M18 39l-4-3 1-6 7 1 3 5zM31 17l-4-5 3-6 7 2 2 6zM57 12l-3-6 4-5 6 3 1 6zM88 37l4-4 6 2-1 7-6 2zM79 78l5 2 1 6-6 3-5-4zM38 86l-5 3-5-4 1-6 6-1z" />
      </svg>
      <div className="commandSurfaceCore">
        <span className="commandSurfaceCoreRing" />
        <ScopeForgeMark size={78} decorative />
      </div>
    </div>
  );
}
