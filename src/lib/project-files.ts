// Shared types for the multi-file React project model.
export type ProjectFiles = Record<string, string>;

export const DEFAULT_ENTRY = "App.tsx";

export const STARTER_FILES: ProjectFiles = {
  "App.tsx": `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="text-center">
        <h1 className="text-5xl font-semibold tracking-tight">Empty canvas</h1>
        <p className="mt-3 text-zinc-400">Send a prompt to summon your app.</p>
      </div>
    </div>
  );
}
`,
};
