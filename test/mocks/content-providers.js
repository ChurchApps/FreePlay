const tokenHelperMock = {
  isAuthValid: jest.fn(() => true),
  refreshToken: jest.fn(async () => null)
};

module.exports = {
  __esModule: true,
  getProvider: jest.fn(() => null),
  getAllProviders: jest.fn(() => []),
  getAvailableProviders: jest.fn(() => []),
  networkInstanceToAuth: jest.fn((instance) => ({
    access_token: instance.id,
    refresh_token: JSON.stringify(instance),
    token_type: "network",
    created_at: Math.floor(Date.now() / 1000),
    expires_in: 315360000,
    scope: "freeshow"
  })),
  registerProvider: jest.fn(),
  getProviderConfig: jest.fn(() => null),
  setProviderSecret: jest.fn(),
  TokenHelper: jest.fn(() => tokenHelperMock),
  __tokenHelperMock: tokenHelperMock
};
