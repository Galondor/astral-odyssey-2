import { useEffect, useState } from "react";
import Markdown from "markdown-to-jsx";

export default function RoadmapScreen() {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/roadmap.md`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!controller.signal.aborted) setContent(text);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load roadmap", error);
        setError("Unable to load the roadmap. Please reopen it to try again.");
      }
    };
    load();
    return () => controller.abort();
  }, []);

  return (
    <div className='panel changelog'>
      <h2>Roadmap</h2>
      {error ? <p role='alert'>{error}</p> : content === null ? (
        <p role='status'>Loading roadmap...</p>
      ) : (
        <Markdown className='changelog-content' options={{ forceWrapper: true, disableParsingRawHTML: true }}>
          {content}
        </Markdown>
      )}
    </div>
  );
}
