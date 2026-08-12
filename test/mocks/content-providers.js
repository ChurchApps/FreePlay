const tokenHelperMock = {
  isAuthValid: jest.fn(() => true),
  refreshToken: jest.fn(async () => null)
};

module.exports = {
  __esModule: true,
  getProvider: jest.fn(() => null),
  getAllProviders: jest.fn(() => []),
  getAvailableProviders: jest.fn(() => []),
  registerProvider: jest.fn(),
  getProviderConfig: jest.fn(() => null),
  setProviderSecret: jest.fn(),
  TokenHelper: jest.fn(() => tokenHelperMock),
  __tokenHelperMock: tokenHelperMock
};
