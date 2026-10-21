import { useEffect, useState } from "react";
import Markdown from "markdown-to-jsx";
import { changelogFiles } from "./changelogFiles";

function ChangelogEntry({ entry }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(entry.url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!controller.signal.aborted) setContent(text);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(`Failed to load changelog ${entry.id}`, error);
        setError("Unable to load this changelog. Please reopen it to try again.");
      }
    };
    load();
    return () => controller.abort();
  }, [entry]);

  return (
    <section role='tabpanel' id={`changelog-panel-${entry.id}`} aria-labelledby={`changelog-tab-${entry.id}`}>
      {error ? <p role='alert'>{error}</p> : content === null ? (
        <p role='status'>Loading changelog...</p>
      ) : (
        <Markdown className='changelog-content' options={{ forceWrapper: true, disableParsingRawHTML: true }}>
          {content}
        </Markdown>
      )}
    </section>
  );
}

export default function ChangelogScreen() {
  const [selected, setSelected] = useState(changelogFiles[0]?.id);
  const entry = changelogFiles.find((file) => file.id === selected);

  return (
    <div className='panel changelog'>
      <h2>Changelog</h2>
      {changelogFiles.length === 0 ? <p>No changelogs published yet.</p> : (
        <>
          <div className='inventory-tabs' role='tablist' aria-label='Changelog files'>
            {changelogFiles.map((file) => (
              <button
                key={file.id}
                type='button'
                role='tab'
                id={`changelog-tab-${file.id}`}
                aria-selected={file.id === selected}
                aria-controls={`changelog-panel-${file.id}`}
                className={`inventory-tab ${file.id === selected ? "active" : ""}`}
                onClick={() => setSelected(file.id)}
              >
                {file.label}
              </button>
            ))}
          </div>
          {entry && <ChangelogEntry key={entry.id} entry={entry} />}
        </>
      )}
    </div>
  );
}
