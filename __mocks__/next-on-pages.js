// Mock for @cloudflare/next-on-pages
module.exports = {
  getRequestContext: jest.fn(() => {
    throw new Error('Not in Cloudflare context');
  }),
};

