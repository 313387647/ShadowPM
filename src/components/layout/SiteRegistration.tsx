export function SiteRegistration({ className = "" }: { className?: string }) {
  return (
    <footer className={`shrink-0 px-4 py-4 text-center text-xs text-muted-foreground ${className}`}>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noreferrer"
        className="transition-colors hover:text-foreground"
      >
        蜀ICP备2026040142号
      </a>
    </footer>
  );
}
