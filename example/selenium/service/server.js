import http from 'http';

// TODO: This is example local server from which pages are served.
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
