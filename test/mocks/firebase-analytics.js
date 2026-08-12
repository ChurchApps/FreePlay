const logEvent = jest.fn(async () => {});
const analytics = jest.fn(() => ({ logEvent }));
analytics.logEvent = logEvent;
module.exports = { __esModule: true, default: analytics };
