import { useState } from "react";
import "./App.css";
import GameForm from "./GameForm";
import Tooltip from "./Tooltip";
import { GLOSSARY } from "./glossary";
import { getPlayer } from "./player";
import { DEFAULT_SCREEN, SCREENS } from "./screens";
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
  const [viewOverride, setViewOverride] = useState(null);

  const apply = (result) => {
    setMessages((prev) => [
      ...(result.clearLog ? [] : prev),
      ...result.replies.map((text) => ({ sender: "game", text })),
    ]);
    setSceneId(result.sceneId);
    setViewOverride(null);
    setInput("");
  };

  const send = (text) => {
    if (!text.trim()) return;
    apply(processInput(sceneId, text));
  };

  const pressButton = (label) => apply(processButton(sceneId, label));

  const submitForm = (values) => {
    const result = processForm(sceneId, values);
    if (result.error) {
      setMessages((prev) => [...prev, { sender: "game", text: result.replies[0] }]);
      return;
    }
    apply(result);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const mode = getInputMode(scenes[sceneId]);
  const showButtons = mode === INPUT_MODES[0] || mode === INPUT_MODES[2];
  const showText = mode === INPUT_MODES[1] || mode === INPUT_MODES[2];

  const scene = scenes[sceneId];
  const player = getPlayer();
  const sceneScreen = SCREENS[scene.screen] ? scene.screen : DEFAULT_SCREEN;
  const activeScreen = SCREENS[viewOverride] ? viewOverride : sceneScreen;
  const Screen = SCREENS[activeScreen].component;
  const screenData = activeScreen === sceneScreen && scene.screenData ? scene.screenData() : undefined;

  return (
    <div className='App'>
      <header className='navbar'>
        <span className='nav-title'>Astral Odyssey 2</span>
        {player && (
          <div className='nav-info'>
            <Tooltip content={{ title: player.name, subtitle: `Level ${player.level} ${player.class}` }}>
              <span className='nav-item'>{player.name}</span>
            </Tooltip>
            <Tooltip content={{
              title: "Level",
              ...(player.stats?.exp != null && player.stats?.expToLevel != null
                ? { description: `Exp: ${player.stats.exp}/${player.stats.expToLevel}` }
                : {}),
            }}>
              <span className='nav-item'>Lvl {player.level}</span>
            </Tooltip>
            <Tooltip content={GLOSSARY[player.region]}>
              <span className='nav-item'>{player.region}</span>
            </Tooltip>
            <Tooltip content={GLOSSARY.astra}>
              <span className='nav-item'>{player.astra} astra</span>
            </Tooltip>
          </div>
        )}
      </header>
      <div className='App-body'>
        <nav className='sidebar'>
          {Object.entries(SCREENS).map(([key, s]) => {
            const enabled = !!player && (s.link || key === sceneScreen);
            return (
              <button
                key={key}
                type='button'
                disabled={!enabled}
                className={`sidebar-link ${key === activeScreen ? "active" : ""}`}
                onClick={() => setViewOverride(key === sceneScreen ? null : key)}
              >
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className='game-content'>
          <div className='game-screen'>
            <Screen messages={messages} data={screenData} player={player} />
          </div>
        <div className='game-controls'>
          {mode === INPUT_MODES[3] && (
            <GameForm key={sceneId} form={scenes[sceneId].form} onSubmit={submitForm} />
          )}
          {showButtons && (
            <div className='input-buttons'>
              {getVisibleOptions(scenes[sceneId]).map((o) => (
                <Tooltip key={o.label} content={o.tooltip}>
                  <button className='buttons input-button' type='button' onClick={() => pressButton(o.label)}>
                    {o.label}
                  </button>
                </Tooltip>
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
    </div>
  );
}

export default App;
