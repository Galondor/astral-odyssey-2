import { Fragment, useEffect, useRef, useState } from "react";
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
  const [loadError, setLoadError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(getSaveStatus);
  useEffect(() => subscribeSaveStatus(() => setSyncStatus(getSaveStatus())), []);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setUid(null);
          return;
        }
        setUid(undefined);
        setLoadError(null);
        try {
          await loadPlayer(user.uid);
        } catch (e) {
          console.error("Failed to load player data", e);
          setLoadError("Couldn't load your cloud save. Check your connection and try again.");
          return;
        }
        setUid(user.uid);
      }),
    []
  );

  const logout = async () => {
    try {
      await unloadPlayer();
      await signOut(auth);
    } catch (error) {
      console.error("Couldn't save before signing out", error);
      setLoadError("Your save wasn't confirmed. Reload to sync before signing out.");
    }
  };

  const blocked = loadError || (uid && (syncStatus.error || (syncStatus.offline && "Connection lost. Gameplay is paused until the cloud save can be synchronized.")));
  if (blocked) return <div className='auth-page' role='alert'>
    <p className='auth-subtitle'>{blocked}</p>
    <button className='buttons' onClick={() => window.location.reload()}>Reload cloud save</button>
  </div>;
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
  const { savedAt, dirty, saving, notice } = getSaveStatus();
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
      {notice || text}
    </span>
  );
}

function Game({ uid, onLogout }) {
  const [sceneId, setSceneId] = useState(() => {
    if (!getPlayer() || getPlayer().needsNameChange) return "start";
    if (!getPlayer().stats) return "createCharacter";
    if (getEnemy()) return "combat";
    return expireIfNeeded() || !isInDungeon() ? "menu" : "dungeon";
  });
  const [messages, setMessages] = useState(() => initialMessages(sceneId));
  const [input, setInput] = useState("");
  const [viewOverride, setViewOverride] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarToggle = useRef(null);
  const [sending, setSending] = useState(false);
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

  const send = async (text) => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      apply(await processInput(sceneId, text));
    } finally {
      setSending(false);
    }
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
  const closeSidebar = () => {
    setSidebarOpen(false);
    if (sidebarToggle.current?.getClientRects().length) sidebarToggle.current.focus();
  };

  return (
    <div className='App'>
      <header className='navbar'>
        <span className='nav-title'>Astral Odyssey 2</span>
        <div className='nav-info'>
          {player && (<>
            <Tooltip content={{ title: player.name, subtitle: `Level ${player.level} ${player.class}`, description: `Health: ${player.stats?.health || 0}/${player.stats?.maxHealth || 0}\nStamina: ${player.stats?.stamina || 0}/${player.stats?.maxStamina || 0}\nGear score: ${player.stats?.gearScore || 0}\nReputation: ${getRepRank(getRep(player))} (${getRep(player)})`}}>
              <span className='nav-item'>{player.name}</span>
            </Tooltip>
            {player.stats && (
              <div className='nav-resources' role='group' aria-label='Player resources'>
                <span>Health: {player.stats.health}/{player.stats.maxHealth}</span>
                <span>Stamina: {player.stats.stamina}/{player.stats.maxStamina}</span>
                <span>Power: {player.stats.power}/{player.stats.maxPower}</span>
              </div>
            )}
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
        <nav className='sidebar' aria-label='Game navigation' onKeyDown={(event) => {
          if (event.key === "Escape" && sidebarOpen) {
            event.preventDefault();
            closeSidebar();
          }
        }}>
          <button
            ref={sidebarToggle}
            type='button'
            className='sidebar-toggle'
            aria-expanded={sidebarOpen}
            aria-controls='sidebar-links'
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span>Menu: {SCREENS[activeScreen].label}</span>
            <span aria-hidden='true'>{sidebarOpen ? "-" : "+"}</span>
          </button>
          <div id='sidebar-links' className={`sidebar-links ${sidebarOpen ? "open" : ""}`}>
            {Object.entries(SCREENS).filter(([key, s]) => (!s.hideUnlessActive || key === sceneScreen) && (!s.adminOnly || isAdmin())).map(([key, s], index, visibleScreens) => {
              const enabled = !!player?.stats && !player.needsNameChange && (s.link || key === sceneScreen) && (player.level || 1) >= (s.minLevel || 0);
              const badge = player && s.badge ? s.badge(player) : 0;
              const attention = s.hideUnlessActive && key !== activeScreen;
              return (
                <Fragment key={key}>
                  {index > 0 && s.sidebarGroup !== visibleScreens[index - 1][1].sidebarGroup && <hr className='sidebar-divider' />}
                  <button
                    type='button'
                    disabled={!enabled}
                    aria-current={key === activeScreen ? "page" : undefined}
                    className={`sidebar-link ${key === activeScreen ? "active" : ""} ${s.hideUnlessActive ? "highlight" : ""} ${attention ? "attention" : ""}`}
                    onClick={() => {
                      setViewOverride(key === sceneScreen ? null : key);
                      closeSidebar();
                    }}
                  >
                    {s.label}
                    {badge > 0 && <span className='sidebar-badge'>{badge}</span>}
                  </button>
                </Fragment>
              );
            })}
            <span className='sidebar-version' aria-label='Game version'>v0.2.3.1</span>
          </div>
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
                disabled={sending}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Type your action...'
              />
              <button className='buttons input-button' type='submit' disabled={sending}>Send</button>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default App;
