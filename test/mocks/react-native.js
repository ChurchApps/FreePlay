module.exports = {
  Dimensions: {
    get: jest.fn(() => ({ width: 1920, height: 1080 })),
    addEventListener: jest.fn(() => ({ remove: jest.fn() }))
  },
  Platform: { OS: "android", isTV: true, select: (o) => o.android ?? o.default }
};
