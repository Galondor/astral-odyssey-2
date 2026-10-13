import { useState } from "react";
import {
  getFormDefaults,
  getPointsRemaining,
} from "./gameLogic";

// Generic multi-value form driven by a scene's `form` config.
function GameForm({ form, onSubmit }) {
  const [values, setValues] = useState(() => getFormDefaults(form));
  const remaining = getPointsRemaining(form, values);

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const step = (f, delta) => {
    const next = Number(values[f.key]) + delta;
    const min = f.min ?? 0;
    if (next < min || (f.max !== undefined && next > f.max)) return;
    if (delta > 0 && form.pool && f.pooled !== false && remaining <= 0) return;
    set(f.key, next);
  };

  return (
    <form
      className='game-form'
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      {form.pool && (
        <div className={`pool ${remaining < 0 ? "over" : ""}`}>
          {form.pool.label} remaining: <strong>{remaining}</strong>
        </div>
      )}
      <div className='form-fields'>
        {form.fields.map((f) => {
          const type = f.type || "number";
          return (
            <label key={f.key} className='form-field'>
              <span>{f.label}</span>
              {type === "number" && (
                <span className='stepper'>
                  <button type='button' className='buttons' onClick={() => step(f, -1)}>-</button>
                  <input
                    className='input-field number-input'
                    type='number'
                    min={f.min ?? 0}
                    max={f.max}
                    value={values[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  <button type='button' className='buttons' onClick={() => step(f, 1)}>+</button>
                </span>
              )}
              {type === "select" && (
                <select
                  className='input-field'
                  value={values[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
              {type === "text" && (
                <input
                  className='input-field'
                  maxLength={f.maxLength}
                  value={values[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>
      <button className='buttons input-button' type='submit'>
        {form.submitLabel || "Submit"}
      </button>
    </form>
  );
}

export default GameForm;
