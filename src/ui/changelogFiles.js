const files = require.context("../changelog", false, /\.md$/i);

export const changelogFiles = files.keys()
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  .map((key) => {
    const asset = files(key);
    return {
      id: encodeURIComponent(key.slice(2, -3)),
      label: key.slice(2, -3).replace(/[_-]/g, " "),
      url: typeof asset === "string" ? asset : asset.default,
    };
  });
