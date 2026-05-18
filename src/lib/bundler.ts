// In-browser bundler that compiles a virtual file tree (TSX/TS/JS/JSX/CSS)
// into a single ESM bundle. React/ReactDOM/lucide-react are externalized via
// an iframe import map.
import type { ProjectFiles } from "./project-files";

let initPromise: Promise<typeof import("esbuild-wasm")> | null = null;

const ESBUILD_VERSION = "0.28.0";

async function getEsbuild() {
  if (!initPromise) {
    initPromise = (async () => {
      const esbuild = await import("esbuild-wasm");
      try {
        await esbuild.initialize({
          wasmURL: `https://esm.sh/esbuild-wasm@${ESBUILD_VERSION}/esbuild.wasm`,
          worker: true,
        });
      } catch (err: any) {
        if (!String(err?.message || "").includes("initialize")) throw err;
      }
      return esbuild;
    })();
  }
  return initPromise;
}

const EXTERNALS = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
  "lucide-react",
]);

function normalizePath(p: string) {
  return p.replace(/^\.?\/+/, "");
}

function resolveImport(importer: string, importee: string, files: ProjectFiles): string | null {
  if (!importee.startsWith(".")) return null;
  const importerDir = importer.includes("/") ? importer.slice(0, importer.lastIndexOf("/")) : "";
  const parts = (importerDir ? importerDir + "/" : "").split("/").concat(importee.split("/"));
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  const base = stack.join("/");
  const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, `${base}/index.tsx`, `${base}/index.ts`];
  for (const c of candidates) if (files[c] != null) return c;
  return null;
}

function loaderFor(path: string): "tsx" | "ts" | "jsx" | "js" | "css" {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".css")) return "css";
  return "js";
}

export interface FailedImport {
  specifier: string;
  importer: string;
  kind: "missing-file" | "missing-package";
  suggestion: string;
}

export interface BundleResult {
  code: string;
  errors: string[];
  resolvedEntry: string | null;
  failedImports: FailedImport[];
}

const ENTRY_CANDIDATES = ["App.tsx", "App.jsx", "App.ts", "App.js", "app.tsx", "src/App.tsx"];

function pickEntry(files: ProjectFiles, requested?: string): string | null {
  if (requested && files[normalizePath(requested)] != null) return normalizePath(requested);
  for (const c of ENTRY_CANDIDATES) if (files[c] != null) return c;
  // Fallback: first .tsx/.jsx file with a default export
  for (const [k, v] of Object.entries(files)) {
    if (/\.(tsx|jsx)$/.test(k) && /export\s+default/.test(v)) return k;
  }
  return null;
}

export async function bundleProject(rawFiles: ProjectFiles, entry?: string): Promise<BundleResult> {
  const files: ProjectFiles = {};
  for (const [k, v] of Object.entries(rawFiles)) files[normalizePath(k)] = v;

  const resolvedEntry = pickEntry(files, entry);
  if (!resolvedEntry) {
    return {
      code: "",
      resolvedEntry: null,
      failedImports: [],
      errors: [
        "No entry file found. Expected one of: App.tsx, App.jsx, App.ts, App.js. Use the entry picker to choose or upload one.",
      ],
    };
  }

  const esbuild = await getEsbuild();
  const failedImports: FailedImport[] = [];

  const virtualPlugin = {
    name: "virtual-fs",
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        if (args.kind === "entry-point") return { path: normalizePath(args.path), namespace: "vfs" };
        if (EXTERNALS.has(args.path)) {
          return { path: args.path, external: true };
        }
        if (/^https?:/.test(args.path)) return { path: args.path, external: true };
        if (args.path.startsWith(".")) {
          const resolved = resolveImport(args.importer, args.path, files);
          if (resolved) return { path: resolved, namespace: "vfs" };
          failedImports.push({
            specifier: args.path,
            importer: args.importer,
            kind: "missing-file",
            suggestion: `File "${args.path}" is missing in the project. Ask the AI to create it, or upload it as an entry file.`,
          });
          return { errors: [{ text: `Cannot resolve "${args.path}" from "${args.importer}"` }] };
        }
        // bare import not in externals — proxy through esm.sh as best effort
        failedImports.push({
          specifier: args.path,
          importer: args.importer,
          kind: "missing-package",
          suggestion: `Package "${args.path}" isn't in the preview's import map. Stick to react, react-dom, lucide-react, or relative files for reliable previews.`,
        });
        return { path: `https://esm.sh/${args.path}?dev&external=react,react-dom`, external: true };
      });
      build.onLoad({ filter: /.*/, namespace: "vfs" }, (args: any) => {
        const contents = files[args.path];
        if (contents == null) return { errors: [{ text: `Missing virtual file ${args.path}` }] };
        return { contents, loader: loaderFor(args.path) };
      });
    },
  };

  try {
    const result = await esbuild.build({
      entryPoints: [resolvedEntry],
      bundle: true,
      format: "esm",
      jsx: "automatic",
      jsxImportSource: "react",
      target: "es2020",
      write: false,
      plugins: [virtualPlugin],
      logLevel: "silent",
    });
    const out = result.outputFiles?.[0]?.text ?? "";
    const errors = result.errors.map((e) => e.text);
    return { code: out, errors, resolvedEntry, failedImports };
  } catch (e: any) {
    const msgs: string[] = [];
    if (e?.errors?.length) for (const er of e.errors) msgs.push(er.text);
    else msgs.push(e?.message ?? String(e));
    return { code: "", errors: msgs, resolvedEntry, failedImports };
  }
}

export function buildPreviewSrcDoc(bundleCode: string, opts: { visualEdit: boolean; customCss?: string }) {
  const visualEditScript = opts.visualEdit ? VISUAL_EDIT_RUNTIME : "";
  const css = opts.customCss ?? "";
  return `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19?dev",
    "react/": "https://esm.sh/react@19/",
    "react-dom": "https://esm.sh/react-dom@19?dev&external=react",
    "react-dom/": "https://esm.sh/react-dom@19/",
    "react-dom/client": "https://esm.sh/react-dom@19/client?dev&external=react",
    "react/jsx-runtime": "https://esm.sh/react@19/jsx-runtime?dev",
    "react/jsx-dev-runtime": "https://esm.sh/react@19/jsx-dev-runtime?dev",
    "lucide-react": "https://esm.sh/lucide-react?dev&external=react"
  }
}
</script>
<style>html,body,#root{height:100%;margin:0;background:#0a0a0a;color:#fff;font-family:ui-sans-serif,system-ui,sans-serif}${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">
const post = (type, payload) => { try { parent.postMessage({ type, ...(payload||{}) }, '*'); } catch {} };
window.addEventListener('error',(e)=>post('aurum:error',{message:e.error?.stack||e.message}));
window.addEventListener('unhandledrejection',(e)=>post('aurum:error',{message:e.reason?.stack||String(e.reason)}));
try {
  const blob = new Blob([${JSON.stringify(bundleCode)}], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const mod = await import(url);
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const App = mod.default;
  if (!App) throw new Error('Entry file must export default a React component');
  createRoot(document.getElementById('root')).render(React.createElement(App));
  post('aurum:ready');
  ${visualEditScript}
} catch (e) { post('aurum:error', { message: e?.stack || e?.message || String(e) }); }
</script>
</body></html>`;
}

const VISUAL_EDIT_RUNTIME = `
(function(){
  let hovered=null;
  const ring='2px solid #c9a84c';
  document.addEventListener('mouseover',(e)=>{
    if(hovered) hovered.style.outline='';
    hovered=e.target; if(hovered && hovered.style) hovered.style.outline=ring;
  },true);
  document.addEventListener('mouseout',()=>{ if(hovered){hovered.style.outline=''; hovered=null;} },true);
  document.addEventListener('click',(e)=>{
    e.preventDefault(); e.stopPropagation();
    const el=e.target;
    parent.postMessage({type:'aurum:select', tag:el.tagName.toLowerCase(), text:(el.textContent||'').slice(0,500), outerHtml:el.outerHTML.slice(0,3500)},'*');
  },true);
})();
`;
