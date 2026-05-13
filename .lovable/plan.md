## Goal
Replace Aurum's single-HTML "forge" engine with a real multi-file React + Tailwind generator that streams, snapshots versions, and supports element-level visual edits — like Lovable.

## Scope (this turn)

### 1. Multi-file project generation
- AI returns a structured JSON file tree: `{ "files": { "App.tsx": "...", "components/Hero.tsx": "...", ... } }` plus a `summary` and `thought` field.
- New server function `generateProject` (replaces `generateApp`):
  - System prompt instructs the model to output strict JSON with files for `App.tsx`, optional `components/*.tsx`, and an optional `index.css`. React 19, Tailwind via CDN, lucide-react via esm.sh, no build step needed.
  - Uses `google/gemini-3-flash-preview` with `response_format: { type: "json_object" }`.
  - Streams via SSE (Server-Sent Events) back to the client so the chat shows tokens live.
- Spend credit before the call (existing `spend_credit` RPC).
- Persist user msg, assistant msg (full JSON), and thought duration.

### 2. In-browser bundler & sandboxed preview
- Add `esbuild-wasm` as a dependency.
- New `src/lib/bundler.ts`: compiles the virtual file tree into a single ESM bundle in the browser. JSX/TSX → JS, externals (`react`, `react-dom/client`, `lucide-react`) resolved via `https://esm.sh`.
- The iframe receives an `srcdoc` with: Tailwind CDN, importmap to esm.sh, the bundled module, and a mount root. Iframe stays sandboxed (`allow-scripts`, no `allow-same-origin`).
- Bundler errors are captured and surfaced as a red overlay in the preview pane (not a crash).

### 3. Versions table + per-turn snapshots
- New table `project_versions(id, project_id, message_id, files jsonb, summary text, thought_ms int, created_at)` with RLS scoped to project owner.
- Every successful generation inserts a version row tied to the assistant message.
- `projects.current_code` stays as the latest bundled HTML for fast re-mount, but versions are the source of truth.
- API: `restoreVersion(version_id)` server fn — copies that version's files to a new "Restored from vN" version + sets as current.

### 4. Lovable-style chat UI rewrite
- Builder layout: left rail = chat, right = preview.
- Each AI message renders as a card:
  - Header: "Thought for Xs" (animated while streaming).
  - Body: short titled summary line (e.g. "Added hero & pricing grid").
  - Footer tabs: **Preview** (loads that version into the iframe) / **Details** (shows file diff vs prior version, collapsible) / **Restore** button.
- Streaming text appears progressively above the card while the model is still emitting.
- Markdown rendered via `react-markdown`.

### 5. Visual edit mode
- Toggle button "Edit" in builder toolbar.
- When on, iframe gets a `?visualEdit=1` flag; bundle injects a tiny script that:
  - On hover, outlines the element under cursor with a gold ring.
  - On click, posts `{ type: "elementSelected", path, html, text }` to parent.
- Parent shows a floating prompt input anchored to the selection: "Tell me how to change this…". Submitting sends a normal generate turn with extra system context: "User selected element: <path>. They want: <prompt>." So it's a refined edit, not a full rebuild.

### 6. Polish
- Builder shows live spend per turn ("-1 credit").
- Empty state on a fresh project triggers the model from `?initial=` query param automatically.
- Toast on out-of-credits links to `/pricing`.

## Out of scope (next turn, on request)
- Email sender domain + branded OTP/receipt templates.
- GitHub repo sync.
- Actually executing user-installed npm packages beyond the curated externals (react, react-dom, lucide-react). If users want others, we extend the bundler later.
- Stripe webhook → premium credit grant (already partial; will revisit with email).

## Technical notes

### File layout
```text
src/lib/
  ai-builder.functions.ts          # rewritten: generateProject, restoreVersion
  bundler.ts                        # esbuild-wasm bundler (client-only)
  project-files.ts                  # ProjectFiles type, defaults
src/routes/_authenticated/
  builder.$id.tsx                   # rewritten layout
src/components/builder/
  ChatPanel.tsx                     # streaming chat list
  MessageCard.tsx                   # Thought / Summary / Preview-Details-Restore
  PreviewPane.tsx                   # iframe + bundle host + visual-edit overlay
  VisualEditPrompt.tsx              # floating input on selection
supabase/migrations/
  <ts>_project_versions.sql         # new table + RLS
```

### Streaming
Server fn returns a `Response` with `text/event-stream`. Client reads via `fetch` + `getReader()`. Each SSE event: `{ type: "thought" | "delta" | "done", ... }`. (We bypass `useServerFn` for this one because it doesn't expose the raw stream — call the underlying URL directly.)

### Bundler
`esbuild-wasm` is ~2.5MB; lazy-loaded only when the builder route mounts. WASM file served from a CDN to keep the worker bundle small.

### Visual edits
The injected script lives in `src/lib/visual-edit-runtime.ts` as a string export, stitched into the iframe srcdoc when edit mode is on.

## Risks
- esbuild-wasm initialization on slow networks (~1s first load) — mitigated with a "Booting bundler…" state.
- Model occasionally returns malformed JSON despite `response_format` — wrap parse in try/catch; on failure, keep prior version, surface error in chat.
- AI gateway streaming format must be SSE-compatible — verified: Lovable AI Gateway proxies OpenAI-format `delta` chunks.

## Verification
1. Create new project from dashboard with prompt "landing page for a coffee shop".
2. Confirm SSE streaming visible in chat, preview renders, files visible in Details tab.
3. Send follow-up "make the hero black" — new version card appears, prior preserved, Restore works.
4. Toggle Edit, click hero text, send "make this bigger" — only that element changes.
5. Out-of-credits path: spend down, confirm toast + pricing link.
