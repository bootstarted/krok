import Server from 'leadfoot/Server';

export const leadfoot = {
  // can use one of: browserstack, saucelabs, selenium
  dependencies: ['selenium'],
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
  run: ({name}, server) => {
    return server.createSession({
      // See: https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options
      // Upstream settings.
      ...server.capabilities,

      // Session information.
      // name,
      // build: 'xxx',

      // Timeouts.
      // maxDuration: 600,
      // commandTimeout: 300,
      // idleTimeout: 90,

      // Leadfoot feature detection.
      // See: https://theintern.github.io/leadfoot/global.html#Capabilities
      fixSessionCapabilities: false,

      // Browser settings.
      // See: https://wiki.saucelabs.com/display/DOCS/Platform+Configurator
      // screenResolution: '1280x1024',
      // platform: 'Windows 10',
      browserName: 'chrome',
      // version: '51.0',
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
