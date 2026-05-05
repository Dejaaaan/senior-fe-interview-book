# Contributing

Thanks for considering a contribution. The book is one Markdown source rendered to two outputs (Docusaurus web + Quarto PDF/EPUB), plus runnable code samples. Keep that constraint in mind.

## Chapter conventions

- One chapter per `NN-kebab-case.md` file in `content/<part>/`.
- Frontmatter is minimal:

```yaml
---
title: "Chapter title"
description: "One-sentence summary that shows in the docs sidebar and PDF metadata."
sidebar_position: 1
---
```

- Heading hierarchy: `# Chapter title` once at the top, then `##` for sections.
- Every chapter ends with three sections, in this order:
  1. `## Key takeaways`
  2. `## Common interview questions`
  3. `## Further reading`

## Style

- TypeScript for code samples; specify the language in the fence (` ```ts `, ` ```tsx `).
- Diagrams use Mermaid only.
- Callouts use blockquotes (portable across Docusaurus and Quarto):

```markdown
> **Note:** This is a callout that renders identically in both pipelines.
```

Avoid Docusaurus-only `:::note` and Quarto-only shortcodes.

- Tables: simple GFM tables.
- Inline code with backticks; multi-line in fences with language tags.
- Cross-link other chapters with relative paths from the file:

```markdown
See [Authentication & Authorization → Cookies](./content/10-auth/04-cookies.md).
```

## Code samples

Long code lives in `code/<package>/`. Reference it inline with a short excerpt; link to the full file at GitHub.

Each `code/*` package is independently installable via the workspace. Keep external deps minimal; pin major versions.

## Tone

- Senior reader assumed; explain _why_ not just _how_.
- Trade-offs framed explicitly.
- Prefer the 2026 mainstream choice; note alternatives.
- Avoid hyperbole and emoji (in prose; emoji in code/diagrams is fine when meaningful).

## Editorial style (the seven lenses)

Every chapter must satisfy the following editorial rules. They were defined during the improvements pass and are the standard for all new and updated content.

### 1. Formal voice

Use precise, professional vocabulary. Avoid slang, hedges, and colloquialisms. Concrete substitutions:

| Avoid                                       | Prefer                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| "gotcha" / "gotchas"                        | "subtlety" / "pitfall"                                  |
| "foot-gun" / "footgun"                      | "operational hazard" / "common source of incidents"     |
| "What you got:"                             | "What this provides:"                                   |
| "the senior framing"                        | "the framing senior candidates typically present"       |
| "spicy" / "wild" / "boom" / "lol" / "yikes" | remove and rephrase                                     |
| "huge" / "massive" / "crazy" / "insane"     | "substantial" / "considerable"                          |
| "kinda" / "sorta"                           | "somewhat" or remove the hedge                          |
| "gonna" / "wanna"                           | "going to" / "intend to"                                |
| "stuff"                                     | the specific noun (modules, dependencies, side effects) |
| "tricky"                                    | "non-trivial" / "subtle"                                |
| "Don't ... Period."                         | "This is not a recommended approach because ..."        |

In prose use "for example" and "that is" rather than `e.g.` / `i.e.`. Parenthetical Latin abbreviations are acceptable only inside lists or code comments.

### 2. Immersive descriptions

A bare bullet list of four or more items in a chapter introduction, "What this provides", "Costs", "Common pitfalls", or "Key takeaways" section must be either rewritten as a paragraph or expanded so that each bullet carries one descriptive sentence. The reader should never see a bullet list of bare nouns.

### 3. Inline code wherever it sharpens the explanation

Add a small TypeScript snippet next to any concept that can be made concrete. Triggers:

- A named application programming interface (API), method, hook, or class.
- A configuration, header, policy, schema, or environment variable described in words ("set `Cache-Control: private`" should be shown as a code line).
- A pattern described abstractly (debounce, circuit breaker, request coalescing, single-flight refresh, optimistic update with rollback).
- A "you would do X" sentence where X is non-trivial.
- A cross-reference to a runnable demo in `code/*` — inline an excerpt rather than only linking out.

The bar is: if a senior reader could plausibly ask "show me what that looks like in code", the snippet belongs in the chapter. Snippets stay short (≤ 30 lines), TypeScript by default, and follow the imports and style conventions used elsewhere in the book.

### 4. Expand abbreviations on first use

On first appearance in each chapter, write the full term followed by the acronym in parentheses. Examples: `Backend-for-Frontend (BFF)`, `JSON Web Token (JWT)`, `Identity Provider (IdP)`, `Cross-Site Request Forgery (CSRF)`, `Identity and Access Management (IAM)`. The bare acronym is acceptable thereafter within that chapter. Each chapter is treated independently — readers may arrive on a single page from search, so a per-chapter expansion is required even if an earlier chapter expanded the same acronym.

### 5. Deepen thin explanations

A single sentence is acceptable only for self-evident concepts already covered by an earlier chapter (in which case use a cross-link). Otherwise expand to mechanism, trade-offs, and a small example. Detection heuristic: any subsection heading whose body is shorter than three sentences and that introduces a non-trivial concept; any sentence introducing a technology with no follow-up explanation; any "see X" pointer where X is not covered elsewhere in the book. The judgement call is: expand whenever the reader would otherwise be left wondering "but how does it actually work?".

### 6. Detailed answers to interview questions

Every `## Common interview questions` section must be followed immediately by an `## Answers` subsection containing one detailed answer per question. The structure for each answer:

````markdown
### 1. <restated question>

<Direct answer paragraph: 1-3 sentences that a senior candidate would lead with.>

**How it works.** <Mechanism / reasoning paragraph.>

```ts
// Optional inline snippet that makes the mechanism concrete.
```
````

**Trade-offs / when this fails.** <Closing paragraph that names the limits, alternative approaches, or operational hazards.>

<Optional one-line cross-link: "See [Part X — Y](../path/file.md#anchor) for the full discussion.">

````

Length target: 150-400 words per answer, no answer shorter than 100 words. Aim for the depth a senior candidate would actually deliver in an interview rather than a one-liner.

### 7. New React client-auth chapter

Cross-link from React or Next.js chapters discussing auth into [`content/10-auth/08-react-client.md`](content/10-auth/08-react-client.md), which is the canonical home for client-side React authentication patterns (token storage, `useAuth`, route guards, fetch wrappers with silent refresh, cross-tab logout, pure-client Proof Key for Code Exchange flows, and testing).

## Local development

```bash
pnpm install
pnpm web:dev          # http://localhost:3000
pnpm print:preview    # Quarto live preview
pnpm build            # builds both
````

### Installing Quarto

Download and install Quarto from the official Get Started page: <https://quarto.org/docs/get-started/>. The page lists installers for Windows, macOS, and Linux. After installing, verify with:

```bash
quarto --version
quarto check
```

For PDF output: install the bundled minimal TeX distribution once with `quarto install tinytex`.

For Mermaid diagrams in the PDF output: install Chromium with `quarto install chromium`.

## Pull requests

- One concern per PR. Refactors separate from new chapters.
- Include a short `Test plan` in the PR description (what you ran).
- The CI builds Docusaurus + Quarto + runs code-sample tests. If anything breaks, it'll tell you.

## Things to NOT do

- Don't introduce MDX components (breaks Quarto).
- Don't introduce Docusaurus admonitions (`:::tip`, etc. — breaks Quarto).
- Don't introduce Quarto-specific shortcodes in `content/` (breaks Docusaurus). Quarto-only material belongs in `print/index.qmd`.
- Don't create new top-level `Part` folders without updating both `web/sidebars.ts` and `print/_quarto.yml`.

## License

By contributing, you agree to license your contribution under the same terms as the project (CC BY-NC-SA 4.0 for prose, MIT for code).
