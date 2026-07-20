export function SiteRegistration({ className = "" }: { className?: string }) {
  return (
    <footer className={`shrink-0 px-4 py-2 text-center text-[11px] text-muted-foreground/45 ${className}`}>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noreferrer"
        className="transition-colors hover:text-muted-foreground"
      >
        蜀ICP备2026040142号
      </a>
    </footer>
  );
}
