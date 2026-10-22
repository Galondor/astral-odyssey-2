import { useState } from "react";
import {
  MAX_BUG_DESCRIPTION_LENGTH,
  MAX_BUG_TITLE_LENGTH,
  submitBugReport,
} from "../world/bugReports";

const BugReportScreen = () => {
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
      await submitBugReport({ title, description });
      setTitle("");
      setDescription("");
      setNote("Thanks! Your bug report has been sent.");
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
      <h2>Report a bug</h2>
      <p>Tell us what happened and how we can reproduce it. Please don't include personal information.</p>
      <form className='admin-form' onSubmit={submit}>
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
          What happened?
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
          {busy ? "Sending..." : "Submit bug report"}
        </button>
        {note && <div className={error ? "auth-error" : "recipe-note"} role={error ? "alert" : "status"}>{note}</div>}
      </form>
    </div>
  );
};

export default BugReportScreen;
