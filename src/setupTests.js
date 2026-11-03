beforeEach(() => {
  window.matchMedia = jest.fn((media) => ({
    media,
    matches: false,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});
