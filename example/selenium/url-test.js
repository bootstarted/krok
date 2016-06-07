import http from 'http';

export default (url) => {
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
