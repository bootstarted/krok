import Server from 'leadfoot/Server';

export const leadfoot = {
  // can use one of: browserstack, saucelabs, selenium
  dependencies: ['saucelabs'],
  run: (task, {url, capabilities}) => {
    const server = new Server(url);
    server.capabilities = capabilities;
    return Promise.resolve(server);
  },
  format: (server) => server.url,
};

export const session = {
  dependencies: ['leadfoot'],
  format: (session) => session.sessionId,
  run: (task, server) => {
    return server.createSession({
      ...server.capabilities,
      fixSessionCapabilities: false,
      browserName: 'chrome',
    }, {});
  },
  dispose: (session) => {
    return session.quit();
  },
};

/*
.then(() => {
  return Promise.resolve({
    url: `https://saucelabs.com/tests/${session.sessionId}`,
  });
});
 */

/*
export const coverage = {
  dependencies: (context) => [`session@${context}`],
  run: (session) => session.execute(() => {
    return window.__coverage__;
  }),
};

export const coverageBE = {
  dependencies: ['server'],
  run: (server) => {
    // probe __coverage__ from node somehow
    return Promise.resolve();
  },
};
*/
