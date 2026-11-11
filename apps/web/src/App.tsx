export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h1 className="text-lg font-semibold">Mission Lab</h1>
      </header>
      <main
        aria-label="Workspace"
        data-testid="workspace"
        className="flex flex-1 items-center justify-center p-4 text-neutral-400"
      >
        Workspace placeholder
      </main>
    </div>
  );
}
