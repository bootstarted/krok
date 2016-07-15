import {Local} from 'browserstack-local';

export const browserstack = {
  run: () => {
    // TODO: localIdentifier
    const options = {
      key: process.env.BROWSERSTACK_ACCESS_KEY,
    };
    const local = new Local();
    return new Promise((resolve, reject) => {
      return local.start(options, (err) => {
        if (err) {
          reject(err);
        } else {
          local.url = 'http://hub-cloud.browserstack.com/wd/hub';
          local.capabilities = {
            'browserstack.local': true,
            'browserstack.user': process.env.BROWSERSTACK_USERNAME,
            'browserstack.key': process.env.BROWSERSTACK_ACCESS_KEY,
          };
          resolve(local);
        }
      });
    });
  },
  dispose: (local) => {
    return new Promise((resolve, reject) => {
      return local.stop((err) => err ? reject(err) : resolve());
    });
  },
  format: (local) => `${local.url}`,
};
