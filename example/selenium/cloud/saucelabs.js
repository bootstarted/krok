import sauceConnectLauncher from 'sauce-connect-launcher';
import uuid from 'uuid';

export const saucelabs = {
  run: () => {
    return new Promise((resolve, reject) => {
      // TODO: tunnelIdentifier
      const options = {
        port: 4555,
        tunnelIdentifier: uuid.v1(),
      };
      sauceConnectLauncher(
        options,
        (err, sauce) => {
          if (err) {
            reject(err);
          } else {
            const u = process.env.SAUCE_USERNAME;
            const p = process.env.SAUCE_ACCESS_KEY;
            sauce.port = options.port;
            sauce.url = `http://${u}:${p}@localhost:${options.port}/wd/hub`;
            sauce.capabilities = {
              tunnelIdentifier: options.tunnelIdentifier,
            };
            resolve(sauce);
          }
        }
      );
    });
  },
  dispose: (sauce) => {
    return new Promise((resolve, reject) => {
      sauce.close((err) => err ? reject(err) : resolve());
    });
  },
  format: (sauce) => `port: ${sauce.port}`,
};
