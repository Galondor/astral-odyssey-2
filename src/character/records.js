export const updateRecords = (player, patch, { increments = {}, maxima = {} } = {}) => {
  const records = { ...(player?.records || {}), ...(patch.records || {}) };
  for (const [key, amount] of Object.entries(increments))
    records[key] = (records[key] || 0) + amount;
  for (const [key, value] of Object.entries(maxima))
    records[key] = Math.max(records[key] || 0, value);
  patch.records = records;
  return patch;
};
