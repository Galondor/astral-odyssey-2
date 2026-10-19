import { useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";

const ERRORS = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
  "auth/operation-not-allowed": "This sign-in method is not enabled in the Firebase console.",
  "auth/unauthorized-domain": "This domain is not authorized. Add it under Authentication > Settings > Authorized domains.",
  "auth/popup-blocked": "The sign-in popup was blocked by your browser.",
  "auth/configuration-not-found": "Authentication is not set up for this Firebase project. Click Get started under Authentication.",
};

export default function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const run = async (action) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        console.error(e);
        setError(ERRORS[e.code] || `Something went wrong (${e.code || e.message}).`);
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (signup && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    run(() =>
      signup
        ? createUserWithEmailAndPassword(auth, email.trim(), password)
        : signInWithEmailAndPassword(auth, email.trim(), password)
    );
  };

  return (
    <div className='auth-page'>
      <form className='auth-card' onSubmit={submit}>
        <h1 className='auth-title'>Astral Odyssey 2</h1>
        <p className='auth-subtitle'>Your journey awaits.</p>
        <div className='auth-tabs' role='tablist'>
          {["login", "signup"].map((m) => (
            <button
              key={m}
              type='button'
              role='tab'
              aria-selected={mode === m}
              className={`auth-tab ${mode === m ? "active" : ""}`}
              onClick={() => {
                setMode(m);
                setError("");
              }}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>
        <input
          className='input-field'
          type='email'
          placeholder='Email'
          autoComplete='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className='input-field'
          type='password'
          placeholder='Password'
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {signup && (
          <input
            className='input-field'
            type='password'
            placeholder='Confirm password'
            autoComplete='new-password'
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        )}
        {error && <div className='auth-error'>{error}</div>}
        <button className='buttons auth-primary' type='submit' disabled={busy}>
          {signup ? "Create account" : "Log in"}
        </button>
        <div className='auth-divider'>or</div>
        <button
          className='buttons auth-google'
          type='button'
          disabled={busy}
          onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
