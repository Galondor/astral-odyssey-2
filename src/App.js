import { useEffect, useRef, useState } from "react";
import "./App.css";
import GameForm from "./GameForm";
import {
  INPUT_MODES,
  getInputMode,
  getVisibleOptions,
  initialMessages,
  processButton,
  processForm,
  processInput,
  scenes,
} from "./gameLogic";

function App() {
  const [messages, setMessages] = useState(initialMessages);
  const [sceneId, setSceneId] = useState("start");
  const [input, setInput] = useState("");
  const screenRef = useRef(null);

  useEffect(() => {
    const el = screenRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const apply = (playerText, result) => {
    setMessages((prev) => [
      ...prev,
      { sender: "player", text: playerText },
      ...result.replies.map((text) => ({ sender: "game", text })),
    ]);
    setSceneId(result.sceneId);
    setInput("");
  };

  const send = (text) => {
    if (!text.trim()) return;
    apply(text.trim(), processInput(sceneId, text));
  };

  const pressButton = (label) => apply(label, processButton(sceneId, label));

  const submitForm = (values) => {
    const result = processForm(sceneId, values);
    if (result.error) {
      setMessages((prev) => [...prev, { sender: "game", text: result.replies[0] }]);
      return;
    }
    apply(result.summary, result);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const mode = getInputMode(scenes[sceneId]);
  const showButtons = mode === INPUT_MODES[0] || mode === INPUT_MODES[2];
  const showText = mode === INPUT_MODES[1] || mode === INPUT_MODES[2];

  return (
    <div className='App'>
      <div className='game-content'>
        <div className='game-screen' ref={screenRef}>
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.sender}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className='game-controls'>
          {mode === INPUT_MODES[3] && (
            <GameForm key={sceneId} form={scenes[sceneId].form} onSubmit={submitForm} />
          )}
          {showButtons && (
            <div className='input-buttons'>
              {getVisibleOptions(scenes[sceneId]).map((o) => (
                <button key={o.label} className='buttons input-button' type='button' onClick={() => pressButton(o.label)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {showText && (
            <form className='input-form' onSubmit={handleSubmit}>
              <input
                className='input-field'
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Type your action...'
              />
              <button className='buttons input-button' type='submit'>Send</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
