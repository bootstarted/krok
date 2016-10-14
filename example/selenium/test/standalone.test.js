import {expect} from 'chai';

export const example1 = {
  dependencies: ({id}) => [`session@${id}`],
  run: (task, session) => {
    return session.get('http://www.apple.com').then(() => {
      return session.getPageTitle().then((title) => {
        expect(title).to.contain('Apple');
      });
    });
  },
};

export const example2 = {
  dependencies: ({id}) => [`session@${id}`],
  run: (task, session) => {
    return session.get('http://www.google.com').then(() => {
      return session.getPageTitle().then((title) => {
        expect(title).to.contain('Google');
      });
    });
  },
};
