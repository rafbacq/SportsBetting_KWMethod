const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/trade-api',
    createProxyMiddleware({
      target: 'https://trading-api.kalshi.com',
      changeOrigin: true,
      secure: true,
    })
  );
};
