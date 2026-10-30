import { useState } from "react";
import {
  MAX_BUG_DESCRIPTION_LENGTH,
  MAX_BUG_TITLE_LENGTH,
  submitBugReport,
} from "../world/bugReports";

const BugReportScreen = () => {
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNote("");
    setError(false);
    try {
      await submitBugReport({ type, title, description });
      setTitle("");
      setDescription("");
      setNote(`Thanks! Your ${type === "feedback" ? "feedback" : "bug report"} has been sent.`);
    } catch (err) {
      console.error("Couldn't submit bug report", err);
      setNote(err.message || "Couldn't submit your report. Please try again.");
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='panel bug-report'>
      <h2>Feedback / Issues</h2>
      <p>Report a bug or share feedback about the game. Please don't include personal information.</p>
      <form className='admin-form' onSubmit={submit}>
        <label htmlFor='bug-report-type'>
          Message type
          <select
            id='bug-report-type'
            className='input-field'
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value='bug'>Bug</option>
            <option value='feedback'>Game feedback</option>
          </select>
        </label>
        <label htmlFor='bug-report-title'>
          Title
          <input
            id='bug-report-title'
            className='input-field'
            value={title}
            maxLength={MAX_BUG_TITLE_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label htmlFor='bug-report-description'>
          Message
          <textarea
            id='bug-report-description'
            className='input-field'
            rows={7}
            value={description}
            maxLength={MAX_BUG_DESCRIPTION_LENGTH}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>
        <button className='buttons input-button' type='submit' disabled={busy}>
          {busy ? "Sending..." : "Submit message"}
        </button>
        {note && <div className={error ? "auth-error" : "recipe-note"} role={error ? "alert" : "status"}>{note}</div>}
      </form>
    </div>
  );
};

export default BugReportScreen;
