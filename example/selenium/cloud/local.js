import Selenium from 'selenium-standalone';
import http from 'http';

const check = (url) => {
  return new Promise((resolve, reject) => {
    const run = (attempt, err) => {
      if (attempt > 5) {
        reject(err);
        return;
      }
      const wait = 100 * Math.pow(2, attempt);
      setTimeout(() => {
        http.get(url, (result) => {
          resolve();
          result.resume();
        }).once('error', (err) => {
          run(attempt + 1, err);
        });
      }, wait);
    };
    run(0);
  });
};

// https://www.npmjs.com/package/selenium-standalone
export const seleniumInstall = {
  run: () => {
    return new Promise((resolve, reject) => {
      const options = {
        // check for more recent versions of selenium here:
        // https://selenium-release.storage.googleapis.com/index.html
        version: '2.53.1',
        baseURL: 'https://selenium-release.storage.googleapis.com',
        drivers: {
          chrome: {
            version: '2.21',
            arch: process.arch,
            baseURL: 'https://chromedriver.storage.googleapis.com',
          },
          firefox: {
            version: '0.9.0',
            arch: process.arch,
            baseURL: 'https://github.com/mozilla/geckodriver/releases/download',
          },
        },
      };
      Selenium.install(options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({version: '2.53.1'});
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
    const result = new Promise((resolve, reject) => {
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
          process.url = `http://localhost:${port}/wd/hub`;
          process.capabilities = {};
          resolve(process);
        }
      });
    });
    return result.then((result) => {
      return check(result.url).then(() => Promise.resolve(result));
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
    `port: ${process.port}, pid: ${process.pid}`,
};
