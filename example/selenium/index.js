import {expect} from 'chai';

import {runTask, reducer as taskReducer} from '../../src';
import thunk from 'redux-thunk';
import {createStore, combineReducers, applyMiddleware} from 'redux';

import {
  seleniumInstall,
  selenium,
  leadfoot,
  session,
  server,
} from './world';

const example1 = {
  dependencies: ({id}) => [`session@${id}`],
  run: (session) => {
    return session.get('http:/www.apple.com').then(() => {
      return session.getPageTitle().then((title) => {
        expect(title).to.contain('Apple');
      });
    });
  },
};

const example2 = {
  dependencies: ({id}) => [`session@${id}`],
  run: (session) => {
    return session.get('http://www.google.com').then(() => {
      return session.getPageTitle().then((title) => {
        expect(title).to.contain('Google');
      });
    });
  },
};

const index = {
  seleniumInstall,
  selenium,
  server,
  leadfoot,
  session,
  example1,
  example2,
};

const options = {
  task: (id) => {
    const [name, context] = id.split('@', 2);
    return {
      ...index[name],
      id,
      name,
      context,
    };
  },
  run: ({run}, dependencies) => {
    return run(...dependencies);
  },
  dispose: ({dispose}, result) => {
    return dispose ? dispose(result) : Promise.resolve();
  },
  dependencies: (task) => {
    const {dependencies} = task;
    if (Array.isArray(dependencies)) {
      return dependencies;
    } else if (typeof dependencies === 'function') {
      return dependencies(task);
    }
    return [];
  },
  selector: (state) => state.tasks,
  bucket: ({id}) => id,
};

const run = (id) => runTask(options, id);

const reducer = combineReducers({
  tasks: taskReducer,
});

const store = createStore(reducer, applyMiddleware(thunk));

import chalk from 'chalk';

// store.dispatch(run('example1'));
store.dispatch(run('example1'));
store.dispatch(run('example2'));

const icon = (status) => {
  switch (status) {
  case 'COMPLETE':
    return chalk.green('✔');
  case 'ERROR':
  default:
    return chalk.red('✖');
  }
};

const timing = (duration) => {
  return chalk.grey(`${duration} ms`);
};

const formatResult = (result) => {
  return typeof result !== 'undefined' ? chalk.blue(result) : '';
};

const formatError = (error) => {
  if (error.stack) {
    return `${chalk.red(error)} - ${error.stack}`;
  }
  return chalk.red(error);
};

process.on('exit', () => {
  console.log('## ==== Results ==== ##');
  const {results} = options.selector(store.getState());
  Object.keys(results).forEach((key) => {
    const {status, duration, result, error} = results[key];
    const [id] = key.split('@', 2);
    const {format = (i) => i} = index[id];
    const output = status === 'COMPLETE' ?
      formatResult(format(result)) : formatError(error);
    console.log(icon(status), timing(duration), key, output);
  });
});
