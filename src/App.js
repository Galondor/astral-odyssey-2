import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import "./App.css";
import { auth } from "./firebase";
import AuthScreen from "./ui/AuthScreen";
import GameForm from "./ui/GameForm";
import CharacterMenu from "./ui/CharacterMenu";
import ProfileMenu from "./ui/ProfileMenu";
import CharacterSearch from "./ui/CharacterSearch";
import Tooltip from "./ui/Tooltip";
import QuickGuide from "./ui/QuickGuide";
import { Bar } from "./ui/CharacterSummary";
import { commitPlayerChange, getCharacterIdentity, getPlayer, getSaveStatus, loadPlayer, setPlayer, subscribeSaveStatus, unloadPlayer } from "./character/player";
import { createCharacter, deleteCharacter, loadCharacters } from "./character/characters";
import { endCombat, getEnemy } from "./combat/combat";
import { endColosseumRun } from "./world/colosseum";
import { clearBlackjack } from "./world/blackjack";
import { getContestStatus, startContest, subscribeContest } from "./world/contest";
import ContestCombat, { getContestCombatView } from "./ui/ContestCombat";
import { getGroupStatus, startGroupSession, subscribeGroup } from "./world/groupParty";
import { isInGroupDungeon } from "./world/groupState";
import { GroupRunActions } from "./ui/GroupDungeonScreen";
import { expireIfNeeded, isInDungeon } from "./world/dungeons";
import { isLabyrinthActive } from "./world/labyrinth";
import { isAdmin, startInbox } from "./world/inbox";
import { startSocial } from "./world/social";
import { finishWorldBossAttempt, reportWorldBossError, subscribeWorldBoss } from "./world/worldBoss";
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
  const [uid, setUid] = useState(undefined);
  const [roster, setRoster] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [menuError, setMenuError] = useState(null);
  const session = useRef(0);
  const [loadError, setLoadError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(getSaveStatus);
  useEffect(() => subscribeSaveStatus(() => setSyncStatus(getSaveStatus())), []);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, async (user) => {
        const version = ++session.current;
        setCharacterId(null);
        setRoster(null);
        setLoadError(null);
        setMenuError(null);
        setBusy(false);
        if (!user) {
          setUid(null);
          return;
        }
        setUid(undefined);
        try {
          const next = await loadCharacters(user.uid);
          if (version !== session.current) return;
          setRoster(next);
        } catch (e) {
          console.error("Failed to load characters", e);
          if (version === session.current) setLoadError("Couldn't load your characters. Check your connection and try again.");
          return;
        }
        setUid(user.uid);
      });
    return () => { session.current += 1; stop(); };
  }, []);

  const play = async (id) => {
    setBusy(true);
    setMenuError(null);
    const version = session.current;
    try {
      await loadPlayer(uid, id);
      if (version === session.current) {
        endCombat({ preserveSaved: true });
        endColosseumRun();
        clearBlackjack();
        setCharacterId(id);
      }
    } catch (error) {
      console.error("Failed to load character", error);
      if (version === session.current) setLoadError("Couldn't load your character. Reload the cloud save before continuing.");
    } finally {
      if (version === session.current) setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setMenuError(null);
    const version = session.current;
    let id;
    try {
      id = await createCharacter(uid);
      const next = await loadCharacters(uid);
      if (version !== session.current) return;
      setRoster(next);
    } catch (error) {
      console.error("Failed to create character", error);
      if (version === session.current) {
        setMenuError(/^You can create up to \d+ characters\./.test(error.message)
          ? error.message
          : "Couldn't create your character. Check your connection and reload the menu before trying again.");
        setBusy(false);
      }
      return;
    }
    await play(id);
  };

  const removeCharacter = async (id, confirmation) => {
    const version = session.current;
    try {
      await deleteCharacter(uid, id, confirmation);
      const next = await loadCharacters(uid);
      if (version === session.current) setRoster(next);
    } catch (error) {
      console.error("Couldn't delete character", error);
      throw new Error("Couldn't confirm character deletion. Reload the menu before trying again.");
    }
  };

  const mainMenu = async () => {
    if (getContestStatus().locked || isInGroupDungeon()) return;
    setBusy(true);
    try {
      await unloadPlayer();
      endColosseumRun();
      setCharacterId(null);
      setRoster(await loadCharacters(uid));
    } catch (error) {
      console.error("Couldn't save before returning to the main menu", error);
      setLoadError("Your save wasn't confirmed. Reload to sync before switching characters.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (getContestStatus().locked || isInGroupDungeon()) return;
    setBusy(true);
    try {
      if (characterId) await unloadPlayer();
      endColosseumRun();
      await signOut(auth);
    } catch (error) {
      console.error("Couldn't save before signing out", error);
      setLoadError("Your save wasn't confirmed. Reload to sync before signing out.");
    } finally {
      setBusy(false);
    }
  };

  const blocked = loadError || (characterId && (syncStatus.error || (syncStatus.offline && "Connection lost. Gameplay is paused until the cloud save can be synchronized.")));
  if (blocked) return <div className='auth-page' role='alert'>
    <p className='auth-subtitle'>{blocked}</p>
    <button className='buttons' onClick={() => window.location.reload()}>Reload cloud save</button>
  </div>;
  if (uid === undefined || busy) return <div className='auth-page'><p className='auth-subtitle' role='status'>Loading...</p></div>;
  if (uid === null) return <AuthScreen />;
  if (!characterId) return <CharacterMenu roster={roster} error={menuError} onPlay={play} onCreate={create} onDelete={removeCharacter} onLogout={logout} />;
  return <Game key={characterId} uid={uid} onLogout={logout} onMainMenu={mainMenu} />;
}

export function Game({ uid, onLogout, onMainMenu }) {
  const tutorialStorageKey = `astralOdyssey2QuickGuideSeen:${uid}`;
  const [tutorialOpen, setTutorialOpen] = useState(() => localStorage.getItem(tutorialStorageKey) !== "true");
  const [sceneId, setSceneId] = useState(() => {
    if (!getPlayer() || getPlayer().needsNameChange) return "start";
    if (!getPlayer().stats) return "createCharacter";
    if (getEnemy()) return "combat";
    if (expireIfNeeded()) return "menu";
    if (isLabyrinthActive()) return "labyrinth";
    return isInDungeon() ? "dungeon" : "menu";
  });
  const [messages, setMessages] = useState(() => initialMessages(sceneId));
  const [input, setInput] = useState("");
  const [viewOverride, setViewOverride] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(() => window.matchMedia("(max-width: 1000px)").matches);
  const sidebarToggle = useRef(null);
  const sidebar = useRef(null);
  const gameContent = useRef(null);
  const mobileMenuToggle = useRef(null);
  const menuReturnFocus = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigationModal = mobileNavigation && sidebarOpen;
  const [sending, setSending] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1000px)");
    const resize = (event) => {
      setMobileNavigation(event.matches);
      setSidebarOpen(false);
    };
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);

  useEffect(() => {
    if (!navigationModal) return;
    sidebarToggle.current.focus();
    const keepFocusInside = (event) => {
      if (!sidebar.current.contains(event.target)) sidebarToggle.current.focus();
    };
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      if (menuReturnFocus.current?.isConnected) menuReturnFocus.current.focus();
    };
  }, [navigationModal]);

  useEffect(() => startInbox(getCharacterIdentity(), () => setTick((t) => t + 1), uid), [uid]);
  useEffect(() => subscribeWorldBoss(() => {}, reportWorldBossError), []);
  useEffect(() => {
    const stopStatus = subscribeContest(() => {
      const contest = getContestStatus();
      if (contest.playing || (contest.saving && contest.match)) setViewOverride("combat");
      else if (contest.waiting) setViewOverride("arena");
      setTick((tick) => tick + 1);
    });
    const stopContest = startContest();
    return () => { stopStatus(); stopContest(); };
  }, []);
  useEffect(() => {
    let wasLocked = false;
    const stopStatus = subscribeGroup(() => {
      const group = getGroupStatus();
      const locked = group.active && group.inRun;
      if (wasLocked && !locked) setViewOverride("dungeons");
      wasLocked = locked;
      setTick((tick) => tick + 1);
    });
    const stopGroup = startGroupSession();
    const stopSocial = startSocial(() => setTick((tick) => tick + 1));
    return () => { stopStatus(); stopGroup(); stopSocial(); };
  }, []);
  useEffect(() => () => {
    const enemy = getEnemy();
    if (enemy?.worldBossCycle) finishWorldBossAttempt(enemy).catch(reportWorldBossError);
  }, []);
  const apply = useCallback((result) => {
    setMessages((prev) => [
      ...(result.clearLog ? [] : prev),
      ...result.replies.map((text) => ({ sender: "game", text })),
    ]);
    setSceneId(result.sceneId);
    setViewOverride(null);
    setInput("");
  }, []);

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
    if (!text.trim() || sending || getContestStatus().locked || isInGroupDungeon()) return;
    setSending(true);
    try {
      apply(await processInput(sceneId, text));
    } finally {
      setSending(false);
    }
  };

  const pressButton = useCallback((label) => {
    if (!getContestStatus().locked && !isInGroupDungeon()) apply(processButton(sceneId, label));
  }, [sceneId, apply]);

  const submitForm = (values) => {
    if (getContestStatus().locked || isInGroupDungeon()) return;
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
  const sceneControlsVisible = !mobileNavigation || !viewOverride ||
    viewOverride === (scenes[sceneId].screen || DEFAULT_SCREEN);

  useEffect(() => {
    if (!showButtons || !sceneControlsVisible || sending || navigationModal || tutorialOpen || getContestStatus().playing || isInGroupDungeon() ||
      (getContestStatus().match && viewOverride === "combat")) return undefined;

    const selectOptionByNumber = (event) => {
      if (!/^[1-9]$/.test(event.key) || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return;

      const option = getVisibleOptions(scenes[sceneId])[Number(event.key) - 1];
      if (!option) return;

      event.preventDefault();
      pressButton(option.label);
    };

    window.addEventListener("keydown", selectOptionByNumber);
    return () => window.removeEventListener("keydown", selectOptionByNumber);
  }, [sceneId, showButtons, sceneControlsVisible, sending, navigationModal, tutorialOpen, pressButton, viewOverride]);

  const scene = scenes[sceneId];
  const player = getPlayer();
  const contest = getContestStatus();
  const contestLocked = contest.locked;
  const contestView = (contest.playing || (contest.match && viewOverride === "combat"))
    ? getContestCombatView(contest) : null;
  const group = getGroupStatus();
  const groupLocked = group.active && group.inRun;
  const sceneScreen = contestView ? "combat" : groupLocked ? "groupRun" : SCREENS[scene.screen] ? scene.screen : DEFAULT_SCREEN;
  const activeScreen = contestView ? "combat" : contestLocked ? "arena" : groupLocked ? "groupRun" : SCREENS[viewOverride] ? viewOverride : sceneScreen;
  const Screen = SCREENS[activeScreen].component;
  const screenData = contestView?.data || (activeScreen === sceneScreen && scene.screenData ? scene.screenData() : undefined);
  useEffect(() => {
    if (mobileNavigation && gameContent.current) {
      gameContent.current.scrollTop = 0;
      gameContent.current.querySelector(".game-screen").scrollTop = 0;
    }
  }, [mobileNavigation, activeScreen, sceneId]);
  const visibleScreens = Object.entries(SCREENS)
    .filter(([key, s]) => (!s.hideUnlessActive || key === sceneScreen) && (!s.adminOnly || isAdmin()))
    .map(([key, screen]) => ({
      key,
      screen,
      notification: !!(player && screen.notification?.(player)),
    }));
  const hasNotifications = visibleScreens.some(({ notification }) => notification);
  const canNavigate = !!player?.stats && !player.needsNameChange;
  const options = getVisibleOptions(scene);
  const townOption = options.find((option) => option.next === "town" || option.label === "Town");
  const townAvailable = canNavigate && !contestLocked && !groupLocked && !getEnemy() &&
    (sceneId === "town" || !!townOption);
  const characterNavigation = visibleScreens.find(({ key }) => key === "character");
  const otherNotifications = visibleScreens.some(({ key, screen: s, notification }) =>
    key !== "character" && (notification || (player && s.badge?.(player) > 0)));
  const inTown = sceneId === "town" || options.some((option) => option.next === "town");
  const openSidebar = (event) => {
    menuReturnFocus.current = event.currentTarget;
    setSidebarOpen(true);
  };
  const closeSidebar = () => {
    setSidebarOpen(false);
    if (!navigationModal && menuReturnFocus.current?.isConnected) menuReturnFocus.current.focus();
    else if (sidebarToggle.current?.getClientRects().length) sidebarToggle.current.focus();
  };
  const closeTutorial = () => {
    localStorage.setItem(tutorialStorageKey, "true");
    setTutorialOpen(false);
  };
  const updatePublicProfile = async (isPublic) => {
    await commitPlayerChange(() => setPlayer({ publicProfile: isPublic }));
    setTick((tick) => tick + 1);
  };

  return (
    <div className='App'>
      <header className='navbar' inert={navigationModal}>
        <span className='nav-title'>Astral Odyssey 2</span>
        {mobileNavigation && <button type='button' className='buttons mobile-search-toggle' aria-expanded={searchOpen} aria-controls='mobile-player-search' onClick={() => setSearchOpen((open) => !open)}>Search</button>}
        <div id='mobile-player-search' className='player-search-shell' hidden={mobileNavigation && !searchOpen}>
          <CharacterSearch excludeIdentity={getCharacterIdentity()} />
        </div>
        <div className='navbar-actions'>
          {!mobileNavigation && canNavigate && !contestView && activeScreen !== "combat" && activeScreen !== "groupRun" &&
            <section className='desktop-resources' aria-label='Character resources'>
              <span className='desktop-astra'>{player.astra || 0} astra</span>
              <div className='desktop-resource-bars'>
                <Bar label='Health' value={player.stats.health} max={player.stats.maxHealth} color='#1e8449' />
                <Bar label='Stamina' value={player.stats.stamina} max={player.stats.maxStamina} color='#b7791f' />
                <Bar label='Power' value={player.stats.power} max={player.stats.maxPower} color='#1f5fbf' />
              </div>
            </section>}
          <ProfileMenu player={player} sending={sending} inCombat={!!getEnemy() || contestLocked || groupLocked} contestLocked={contestLocked || groupLocked} onMainMenu={onMainMenu} onLogout={onLogout} onSetPublicProfile={updatePublicProfile} />
        </div>
      </header>
      <div className='App-body'>
        {mobileNavigation && canNavigate && !contestView && activeScreen !== "combat" && activeScreen !== "groupRun" &&
          <section className='mobile-resources' aria-label='Character resources' inert={navigationModal}>
            <span className='mobile-astra'>{player.astra || 0} astra</span>
            <div className='mobile-resource-bars'>
              <Bar label='Health' value={player.stats.health} max={player.stats.maxHealth} color='#1e8449' />
              <Bar label='Stamina' value={player.stats.stamina} max={player.stats.maxStamina} color='#b7791f' />
              <Bar label='Power' value={player.stats.power} max={player.stats.maxPower} color='#1f5fbf' />
            </div>
          </section>}
        {navigationModal && <div className='sidebar-backdrop' aria-hidden='true' onClick={closeSidebar} />}
        <div className='sidebar-shell' role={navigationModal ? "dialog" : undefined} aria-modal={navigationModal ? true : undefined} aria-label={navigationModal ? "Game menu" : undefined}>
        <nav ref={sidebar} className={`sidebar ${navigationModal ? "sidebar-open" : ""}`} aria-label='Game navigation' onKeyDown={(event) => {
          if (event.key === "Escape" && sidebarOpen) {
            event.preventDefault();
            closeSidebar();
          }
          if (event.key === "Tab" && navigationModal) {
            const buttons = sidebar.current.querySelectorAll("button:not(:disabled)");
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}>
          <button
            ref={sidebarToggle}
            type='button'
            className='sidebar-toggle'
            aria-expanded={sidebarOpen}
            aria-controls='sidebar-links'
            aria-describedby={hasNotifications ? "sidebar-notification-description" : undefined}
            onClick={(event) => sidebarOpen ? closeSidebar() : openSidebar(event)}
          >
            <span>Menu: {SCREENS[activeScreen].label}</span>
            <span className='burger-icon' aria-hidden='true'><span /><span /><span />
              {hasNotifications && <span className='sidebar-toggle-notification-dot' />}
            </span>
          </button>
          {hasNotifications && <span id='sidebar-notification-description' hidden>Some tabs have notifications</span>}
          <div id='sidebar-links' className={`sidebar-links ${sidebarOpen ? "open" : ""}`}>
            {visibleScreens.map(({ key, screen: s, notification }, index) => {
              const levelLocked = !!s.minLevel && (player?.level || 1) < s.minLevel && !(s.adminAccess && isAdmin());
              const enabled = (!contestLocked || key === (contestView ? "combat" : "arena")) && (!groupLocked || key === "groupRun") &&
                !!player?.stats && !player.needsNameChange && (s.link || key === sceneScreen) &&
                ((player?.level || 1) >= (s.minLevel || 0) || (s.adminAccess && isAdmin()));
              const badge = player && s.badge ? s.badge(player) : 0;
              const attention = s.hideUnlessActive && key !== activeScreen;
              return (
                <Fragment key={key}>
                  {index > 0 && s.sidebarGroup !== visibleScreens[index - 1].screen.sidebarGroup && <hr className='sidebar-divider' />}
                  {mobileNavigation && (index === 0 || s.sidebarGroup !== visibleScreens[index - 1].screen.sidebarGroup) &&
                    <span className='mobile-menu-heading'>{s.sidebarGroup === "adventure" ? "Gameplay" : s.sidebarGroup === "character" ? "Character" : s.sidebarGroup === "community" ? "Community" : SCREENS[sceneScreen].label}</span>}
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
                    {levelLocked ? mobileNavigation ? `${s.label} · Level ${s.minLevel}+` : `Level ${s.minLevel}+` : s.label}
                    {notification && <span className='sidebar-notification-dot' role='img' aria-label={s.notificationLabel || "Unread inventory items"} />}
                    {badge > 0 && <span className='sidebar-badge'>{badge}</span>}
                  </button>
                </Fragment>
              );
            })}
            <button type='button' className='sidebar-link' onClick={() => {
              closeSidebar();
              setTutorialOpen(true);
            }}>
              Quick guide
            </button>
            <span className='sidebar-version' aria-label='Game version'>v0.3.2.0-Alpha</span>
          </div>
        </nav>
        </div>
        <div ref={gameContent} className={`game-content ${mobileNavigation ? "mobile-game-content" : ""}`} inert={navigationModal}>
          <div className='game-screen'>
            <Screen messages={contestView?.messages || messages} data={screenData} player={contestView?.player || player} sceneId={sceneId} goToScene={goToScene} onNavigate={(key) => setViewOverride(key === sceneScreen ? null : key)} inCombat={sceneScreen === "combat" || !!getEnemy()} onChange={() => setTick((t) => t + 1)} />
          </div>
        {contestView ? <ContestCombat key={contest.entry?.matchId} navigationModal={navigationModal} onLeave={() => setViewOverride("arena")} />
          : groupLocked ? <GroupRunActions key={group.run?.id} navigationModal={navigationModal} />
          : !contestLocked && sceneControlsVisible && (!mobileNavigation || showText || mode === INPUT_MODES[3] || (showButtons && options.length > 0)) && <div className={`game-controls ${sceneId === "town" ? "town-controls" : ""}`}>
          {mode === INPUT_MODES[3] && (
            <GameForm key={sceneId} form={scenes[sceneId].form} onSubmit={submitForm} />
          )}
          {showButtons && (
            <div className='input-buttons'>
              {options.map((o, index) => {
                const details = mobileNavigation && (o.label === "Travel" || o.label === "Rest")
                  ? typeof o.tooltip === "function" ? o.tooltip() : o.tooltip
                  : null;
                const cost = (typeof o.actionCost === "function" ? o.actionCost() : o.actionCost) ||
                  details?.footer || (o.label === "Rest" ? details?.description : null);
                return (
                <Tooltip disableOnMobile={sceneId === "combatItems"} key={o.label} content={o.tooltip}>
                  <button
                    className={`buttons input-button ${["Travel", "Continue", "Melee Attack", "Rest"].includes(o.label) ? "input-primary" : ""}`}
                    type='button'
                    disabled={(typeof o.disabled === "function" ? !!o.disabled() : !!o.disabled) || (!!o.minLevel && (player?.level || 1) < o.minLevel)}
                    title={typeof o.disabled === "function" ? o.disabled() || undefined : undefined}
                    onClick={() => pressButton(o.label)}
                  >
                    {!mobileNavigation && `${index + 1}. `}{!!o.minLevel && (player?.level || 1) < o.minLevel ? mobileNavigation ? `${o.label} · Level ${o.minLevel}+` : `Level ${o.minLevel}+` : o.label}
                    {cost && <> <span className='mobile-action-cost'>{cost}</span></>}
                  </button>
                </Tooltip>
              ); })}
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
        </div>}
        {mobileNavigation && !contestLocked && !groupLocked && !sceneControlsVisible &&
          <button type='button' className='buttons mobile-return' onClick={() => setViewOverride(null)}>{SCREENS[sceneScreen].label}</button>}
        </div>
      </div>
      {mobileNavigation && <nav className='mobile-bottom-nav' aria-label='Mobile navigation' inert={navigationModal}>
        <button type='button' disabled={!canNavigate} aria-current={activeScreen === sceneScreen && !inTown ? "page" : undefined} onClick={() => setViewOverride(null)}>{SCREENS.adventure.label}</button>
        <button type='button' disabled={!canNavigate || contestLocked || groupLocked} aria-current={activeScreen === "character" ? "page" : undefined} onClick={() => setViewOverride("character")}>
          Character
          {characterNavigation?.notification && <span className='sidebar-notification-dot' role='img' aria-label='Unread inventory items' />}
          {!!player && SCREENS.character.badge?.(player) > 0 && <span className='sidebar-badge'>{SCREENS.character.badge(player)}</span>}
        </button>
        <button type='button' disabled={!townAvailable} aria-current={inTown && activeScreen === sceneScreen ? "page" : undefined} onClick={() => {
          if (sceneId === "town") setViewOverride(null);
          else if (townOption) pressButton(townOption.label);
        }}>Town</button>
        <button ref={mobileMenuToggle} type='button' aria-current={activeScreen !== sceneScreen && activeScreen !== "character" ? "page" : undefined} aria-expanded={sidebarOpen} aria-controls='sidebar-links' aria-haspopup='dialog' onClick={openSidebar}>
          Menu
          {otherNotifications && <span className='sidebar-notification-dot' role='img' aria-label='Some tabs have notifications' />}
        </button>
      </nav>}
      <QuickGuide open={tutorialOpen} onClose={closeTutorial} />
    </div>
  );
}

export default App;
