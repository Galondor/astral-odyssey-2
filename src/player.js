export const getPlayer = () => {
  const player = localStorage.getItem("Player");
  return player ? JSON.parse(player) : null;
};

// Merge values into the saved player data.
export const setPlayer = (patch) => {
  localStorage.setItem("Player", JSON.stringify({ ...getPlayer(), ...patch }));
};

// Getters read localStorage each time, so values are never stale.
export const Player = {
  get name() {
    return getPlayer()?.name || "";
  },
};