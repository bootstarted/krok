import {expect} from 'chai';
import {runTask, reducer as taskReducer, createTaskRegistry} from '../../src';
import thunk from 'redux-thunk';
import {createStore, combineReducers, applyMiddleware} from 'redux';
import log from 'npmlog';

import {
  seleniumInstall,
  selenium,
  leadfoot,
  session,
  server,
} from './world';

const example1 = {
  dependencies: ({id}) => [`session@${id}`],
  run: (task, session) => {
    return session.get('http:/www.apple.com').then(() => {
      return session.getPageTitle().then((title) => {
        expect(title).to.contain('Apple');
      });
    });
  },
};

const example2 = {
  dependencies: ({id}) => [`session@${id}`],
  run: (task, session) => {
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

const options = createTaskRegistry({
  task: (id) => {
    const [name, context] = id.split('@', 2);
    return {
      ...index[name],
      id,
      name,
      context,
    };
  },
  run: (task, dependencies) => {
    return task.run(task, ...dependencies);
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
});

const run = (id) => runTask(options, id);

const reducer = combineReducers({
  tasks: taskReducer,
});

const store = createStore(reducer, applyMiddleware(thunk));

const logs = {};
log.heading = 'bayside';
store.subscribe(() => {
  const state = store.getState();
  const {results} = options.selector(state);
  Object.keys(results).forEach((id) => {
    const [prefix] = id.split('@', 2);
    const task = results[id];
    if (!logs[id]) {
      logs[id] = log.newItem(id, 1, 1);
    }
    if (task.status === 'COMPLETE' && logs[id].completed() < 1) {
      const {format = (i) => i} = index[prefix];
      if (task.result) {
        logs[id].info(id, format(task.result));
      }
      logs[id].finish();
    } else if (task.status === 'ERROR' && logs[id].completed() < 1) {
      logs[id].error(id, task.error.stack ? task.error.stack : task.error);
      logs[id].finish();
    }
  });
});

log.enableColor();
log.enableUnicode();
log.enableProgress();

store.dispatch(run('example1'));
store.dispatch(run('example2'));

process.on('exit', () => {
  console.log('## ==== Results ==== ##');
  // const state = options.selector(store.getState());
  // console.log(state);
  //
});
