export default function ScopeForgeMark({
  size = 34,
  className,
  title,
  decorative = false,
}: {
  size?: number;
  className?: string;
  title?: string;
  decorative?: boolean;
}) {
  const labelled = Boolean(title) && !decorative;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {labelled ? <title>{title}</title> : null}
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <path d="M13 27A20 20 0 0 1 27 13" />
        <path d="M37 13A20 20 0 0 1 51 27" />
        <path d="M51 37A20 20 0 0 1 37 51" />
        <path d="M27 51A20 20 0 0 1 13 37" />
        <path d="M32 7v8M32 49v8M7 32h8M49 32h8" />
      </g>
      <path
        className="forgeShield"
        d="M32 19 43 23v9c0 8-4.7 13.2-11 16-6.3-2.8-11-8-11-16v-9l11-4Z"
        fill="currentColor"
        opacity="0.16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        className="forgeSpark"
        d="m32 22 2.5 7.5L42 32l-7.5 2.5L32 42l-2.5-7.5L22 32l7.5-2.5L32 22Z"
        fill="var(--forge-ember, #ff8a3d)"
      />
    </svg>
  );
}
