import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const repoHasGit = (() => {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: resolve(__dirname, ".."),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
})();

const config: Config = {
  title: "Senior Frontend Interview Prep",
  tagline:
    "AWS, React/Next.js, Angular basics, Node.js, REST, auth, security and frontend production for senior FE interviews.",
  favicon: "img/logo.svg",

  url: "https://dejaaaan.github.io",
  baseUrl: "/senior-fe-interview-book/",

  organizationName: "Dejaaaan",
  projectName: "senior-fe-interview-book",
  trailingSlash: false,

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  markdown: {
    mermaid: true,
  },

  themes: [
    "@docusaurus/theme-mermaid",
    [
      "@easyops-cn/docusaurus-search-local",
      {
        // Index the docs (we have no blog) at the root route base path.
        docsRouteBasePath: "/",
        indexBlog: false,
        indexPages: false,
        // Hashed filenames so the search index is cache-bustable per build.
        hashed: true,
        // Highlight matched terms when navigating from a search result.
        highlightSearchTermsOnTargetPage: true,
        // Show a "See all results" link routing to /search for fuller results
        // when the dropdown limit is exceeded.
        explicitSearchResultPath: true,
        // Show up to 15 hits in the navbar dropdown (default is 8). The full
        // /search page is unaffected and shows every match.
        searchResultLimits: 8,
        // Up to 80 characters of context per result (default 50) so snippets
        // are more useful for technical terms with surrounding code.
        searchResultContextMaxLength: 50,
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          path: "../content",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/Dejaaaan/senior-fe-interview-book/edit/main/",
          showLastUpdateTime: repoHasGit,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/logo.svg",
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "FE Interview Prep",
      logo: {
        alt: "Book logo",
        src: "img/logo.svg",
      },
      items: [
        {
          href: "https://github.com/Dejaaaan/senior-fe-interview-book",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Content licensed under CC BY-NC-SA 4.0 · Code samples MIT · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "yaml", "diff", "hcl", "docker"],
    },
    mermaid: {
      theme: { light: "neutral", dark: "dark" },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
