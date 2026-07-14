import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; text: string };

function getGuideMarkdown() {
  return readFileSync(path.join(process.cwd(), "project-docs/BEGINNER_TUTORIAL.md"), "utf-8");
}

function parseGuide(markdown: string) {
  const blocks: Block[] = [];
  const lines = markdown.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", text: paragraph.join(" ").trim() });
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    blocks.push({ type: "ul", items: list });
    list = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = null;
      } else {
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h1", text: trimmed.replace(/^#\s+/, "") });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") });
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", text: trimmed.replace(/^###\s+/, "") });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: trimmed.replace(/^>\s+/, "") });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.replace(/^-\s+/, ""));
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function slugify(text: string) {
  const cleaned = text
    .replace(/^\d+\.\s*/, "")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned || encodeURIComponent(text);
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={index} className="rounded bg-muted px-1.5 py-0.5 text-[0.92em] text-foreground">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export default function BeginnerGuidePage() {
  const blocks = parseGuide(getGuideMarkdown());
  const title = blocks.find((block) => block.type === "h1")?.text ?? "ShadowPM 完整小白说明书";
  const sections = blocks.filter((block): block is Extract<Block, { type: "h2" }> => block.type === "h2");

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-12">
          <Badge className="w-fit" variant="secondary">ShadowPM 测试说明书</Badge>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="text-base leading-7 text-muted-foreground">
              这不是简单操作清单，而是完整说明书：包含登录、导航、工作台、项目详情、每个卡片、每张表、每个状态和当前测试要点。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link href="/login">
                前往登录
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/login">
                直接开始测试
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">目录</p>
            <nav className="mt-3 max-h-[72vh] space-y-1 overflow-y-auto pr-1">
              {sections.map((section) => (
                <a
                  key={section.text}
                  href={`#${slugify(section.text)}`}
                  className="block rounded-md px-2 py-1.5 text-xs leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {section.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="min-w-0 rounded-xl border bg-card px-5 py-6 shadow-sm sm:px-8">
          <div className="space-y-4">
            {blocks.map((block, index) => {
              if (block.type === "h1") return null;
              if (block.type === "h2") {
                return (
                  <h2
                    key={index}
                    id={slugify(block.text)}
                    className="scroll-mt-8 border-t pt-8 text-2xl font-bold tracking-tight first:border-t-0 first:pt-0"
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "h3") {
                return (
                  <h3 key={index} className="pt-3 text-lg font-semibold">
                    {block.text}
                  </h3>
                );
              }
              if (block.type === "quote") {
                return (
                  <blockquote key={index} className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm leading-7">
                    <InlineText text={block.text} />
                  </blockquote>
                );
              }
              if (block.type === "ul") {
                return (
                  <ul key={index} className="space-y-2 pl-1">
                    {block.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-7 text-muted-foreground">
                        <span className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span><InlineText text={item} /></span>
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.type === "code") {
                return (
                  <pre key={index} className="overflow-x-auto rounded-lg border bg-gray-950 px-4 py-3 text-sm text-gray-50">
                    <code>{block.text}</code>
                  </pre>
                );
              }
              return (
                <p key={index} className="text-sm leading-7 text-muted-foreground">
                  <InlineText text={block.text} />
                </p>
              );
            })}
          </div>
        </article>
      </section>
    </main>
  );
}
