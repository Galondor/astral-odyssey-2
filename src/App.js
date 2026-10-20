import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import "./App.css";
import { auth } from "./firebase";
import AuthScreen from "./ui/AuthScreen";
import GameForm from "./ui/GameForm";
import Tooltip from "./ui/Tooltip";
import { GLOSSARY } from "./ui/glossary";
import { getPlayer, getSaveStatus, loadPlayer, subscribeSaveStatus, unloadPlayer } from "./character/player";
import { getRep, getRepRank } from "./world/quests";
import { getRegion, REGIONS } from "./world/events";
import { getEnemy } from "./combat/combat";
import { expireIfNeeded, isInDungeon } from "./world/dungeons";
import { isAdmin, startInbox } from "./world/inbox";
import { DEFAULT_SCREEN, SCREENS } from "./ui/screens";
import {
  INPUT_MODES,
  getInputMode,
  getVisibleOptions,
  initialMessages,
  processButton,
  processForm,
  processInput,
  scenes,
} from "./world/gameLogic";

function App() {
  // undefined = checking session, null = signed out, string = uid with data loaded
  const [uid, setUid] = useState(undefined);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setUid(null);
          return;
        }
        try {
          await loadPlayer(user.uid);
        } catch (e) {
          console.error("Failed to load player data", e);
        }
        setUid(user.uid);
      }),
    []
  );

  const logout = async () => {
    await unloadPlayer();
    await signOut(auth);
  };

  if (uid === undefined) return <div className='auth-page'><p className='auth-subtitle'>Loading...</p></div>;
  if (uid === null) return <AuthScreen />;
  return <Game key={uid} uid={uid} onLogout={logout} />;
}

function SaveStatus() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeSaveStatus(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);
  const { savedAt, dirty, saving } = getSaveStatus();
  let text;
  if (saving) text = "Saving...";
  else if (!savedAt) text = dirty ? "Unsaved changes" : "Not saved yet";
  else {
    const secs = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
    const ago = secs < 60 ? "just now" : secs < 3600 ? `${Math.floor(secs / 60)}m ago` : `${Math.floor(secs / 3600)}h ago`;
    text = `${dirty ? "Unsaved changes · " : ""}Saved ${ago}`;
  }
  return (
    <span className='nav-item save-status' title={savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}` : undefined}>
      {text}
    </span>
  );
}

function Game({ uid, onLogout }) {
  const [sceneId, setSceneId] = useState(() => {
    if (!getPlayer()) return "start";
    return expireIfNeeded() || !isInDungeon() ? "menu" : "dungeon";
  });
  const [messages, setMessages] = useState(() => initialMessages(sceneId));
  const [input, setInput] = useState("");
  const [viewOverride, setViewOverride] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => startInbox(uid, () => setTick((t) => t + 1)), [uid]);
  const apply = (result) => {
    setMessages((prev) => [
      ...(result.clearLog ? [] : prev),
      ...result.replies.map((text) => ({ sender: "game", text })),
    ]);
    setSceneId(result.sceneId);
    setViewOverride(null);
    setInput("");
  };

  const goToScene = (id) => apply({ sceneId: id, replies: initialMessages(id).map((m) => m.text), clearLog: true });

  // The dungeon timer runs out even while the player is idle
  useEffect(() => {
    const id = setInterval(() => {
      const message = expireIfNeeded();
      if (message) apply({ sceneId: "menu", replies: [message, ...initialMessages("menu").map((m) => m.text)], clearLog: true });
    }, 1000);
    return () => clearInterval(id);
  });

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
        <div className='nav-info'>
          {player && (<>
            <Tooltip content={{ title: player.name, subtitle: `Level ${player.level} ${player.class}`, description: `Health: ${player.stats?.health || 0}/${player.stats?.maxHealth || 0}\nStamina: ${player.stats?.stamina || 0}/${player.stats?.maxStamina || 0}\nGear score: ${player.stats?.gearScore || 0}\nReputation: ${getRepRank(getRep(player))} (${getRep(player)})`}}>
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
              <span className='nav-item'>{REGIONS[getRegion(player)].name}</span>
            </Tooltip>
            <Tooltip content={GLOSSARY.astra}>
              <span className='nav-item'>{player.astra} astra</span>
            </Tooltip>
          </>)}
          <SaveStatus />
          <button type='button' className='buttons' onClick={onLogout}>Log out</button>
        </div>
      </header>
      <div className='App-body'>
        <nav className='sidebar'>
          {Object.entries(SCREENS).filter(([key, s]) => (!s.hideUnlessActive || key === sceneScreen) && (!s.adminOnly || isAdmin())).map(([key, s]) => {
            const enabled = !!player && (s.link || key === sceneScreen) && (player.level || 1) >= (s.minLevel || 0);
            const badge = player && s.badge ? s.badge(player) : 0;
            const attention = s.hideUnlessActive && key !== activeScreen;
            return (
              <button
                key={key}
                type='button'
                disabled={!enabled}
                className={`sidebar-link ${key === activeScreen ? "active" : ""} ${s.hideUnlessActive ? "highlight" : ""} ${attention ? "attention" : ""}`}
                onClick={() => setViewOverride(key === sceneScreen ? null : key)}
              >
                {s.label}
                {badge > 0 && <span className='sidebar-badge'>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className='game-content'>
          <div className='game-screen'>
            <Screen messages={messages} data={screenData} player={player} sceneId={sceneId} goToScene={goToScene} inCombat={sceneScreen === "combat" || !!getEnemy()} onChange={() => setTick((t) => t + 1)} />
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
