import sauceConnectLauncher from 'sauce-connect-launcher';

export const saucelabs = {
  run: () => {
    return new Promise((resolve, reject) => {
      // TODO: tunnelIdentifier
      const options = {port: 4555};
      sauceConnectLauncher(
        options,
        (err, sauce) => {
          if (err) {
            reject(err);
          } else {
            const u = process.env.SAUCE_USERNAME;
            const p = process.env.SAUCE_ACCESS_KEY;
            sauce.url = `http://${u}:${p}@localhost:${options.port}/wd/hub`;
            sauce.capabilities = {};
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
  format: (sauce) => `${sauce.url}`,
};
