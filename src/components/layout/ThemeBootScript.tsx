export function ThemeBootScript() {
  const code = `try { var theme = localStorage.getItem("shadowpm-theme"); document.documentElement.dataset.theme = theme === "light" ? "light" : "dark"; } catch (_) { document.documentElement.dataset.theme = "dark"; }`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
