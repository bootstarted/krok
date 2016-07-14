import Server from 'leadfoot/Server';
import Selenium from 'selenium-standalone';
import http from 'http';
import check from './url-test';

// https://www.npmjs.com/package/selenium-standalone
export const seleniumInstall = {
  run: () => {
    return new Promise((resolve, reject) => {
      const options = {
        // check for more recent versions of selenium here:
        // https://selenium-release.storage.googleapis.com/index.html
        version: '2.53.0',
        baseURL: 'https://selenium-release.storage.googleapis.com',
        drivers: {
          chrome: {
            // check for more recent versions of chrome driver here:
            // https://chromedriver.storage.googleapis.com/index.html
            version: '2.21',
            arch: process.arch,
            baseURL: 'https://chromedriver.storage.googleapis.com',
          },
        },
      };
      Selenium.install(options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({version: '2.53.0'});
        }
      });
    });
  },
  format: ({version}) => `version: ${version}`,
};

// https://www.npmjs.com/package/selenium-standalone
export const selenium = {
  dependencies: ['seleniumInstall'],
  run: () => {
    const port = 4444;
    return new Promise((resolve, reject) => {
      const options = {
        drivers: {
          chrome: {
            version: '2.21',
            arch: process.arch,
          },
        },
        seleniumArgs: ['-port', port],
      };
      Selenium.start(options, (err, process) => {
        if (err) {
          reject(err);
        } else {
          process.port = port;
          resolve(process);
        }
      });
    });
  },
  dispose: (child) => {
    if (child.killed || child.exitCode !== null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 2000);
      child.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
      child.kill('SIGTERM');
    });
  },
  format: (process) =>
    `port: ${process.port}, pid: ${process.pid}, code: ${process.exitCode}`,
};

export const leadfoot = {
  dependencies: ['selenium'],
  run: ({port}) => check(`http://localhost:${port}`).then(
    () => Promise.resolve(new Server(`http://localhost:${port}/wd/hub`))
  ),
  format: (server) => server.url,
};

export const session = {
  dependencies: ['leadfoot'],
  format: (session) => session.sessionId,
  run: (server) => {
    return server.createSession({browserName: 'chrome'}, {});
  },
  dispose: (session) => {
    return session.quit();
  },
};

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

export const server = {
  run: () => new Promise((resolve, reject) => {
    const listener = ((req, res) => {
      res.writeHead(200, 'Hello');
      res.end();
    });
    const server = http.createServer(listener);
    server.once('error', reject);
    server.listen(0, 'localhost', () => {
      const {port} = server.address();
      server.port = port;
      server.url = `http://localhost:${port}`;
      resolve(server);
    });
  }),
  dispose: (server) => new Promise((resolve) => {
    server.close(resolve);
  }),
};
