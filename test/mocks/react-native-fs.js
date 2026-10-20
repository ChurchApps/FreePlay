module.exports = {
  CachesDirectoryPath: "/cache",
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => {}),
  stat: jest.fn(async () => ({ size: 0 })),
  unlink: jest.fn(async () => {}),
  moveFile: jest.fn(async () => {}),
  getFSInfo: jest.fn(async () => ({ freeSpace: Number.MAX_SAFE_INTEGER })),
  writeFile: jest.fn(async () => {}),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) }))
};
