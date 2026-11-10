function BrandLogo({ className = "", decorative = false }) {
  return (
    <img
      src="/brand/toeic-mascot-transparent.png"
      alt={decorative ? "" : "CapyTOEIC"}
      aria-hidden={decorative || undefined}
      draggable="false"
      className={`object-contain ${className}`}
    />
  );
}

export default BrandLogo;
