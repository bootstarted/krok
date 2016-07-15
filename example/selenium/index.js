import {expect} from 'chai';
import {runTask, reducer as taskReducer, createTaskRegistry} from '../../src';
import thunk from 'redux-thunk';
import {createStore, combineReducers, applyMiddleware} from 'redux';
import log from './log';

// Selenium providers.
import * as browserStack from './cloud/browserstack';
import * as sauceLabs from './cloud/saucelabs';
import * as local from './cloud/local';

// Basic world.
import * as world from './world';

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
  ...browserStack,
  ...sauceLabs,
  ...local,
  ...world,
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
  selector: (state) => state.bayside,
  timeout: () => 6000,
});

const run = (id) => runTask(options, id);

const reducer = combineReducers({
  bayside: taskReducer,
});

const store = createStore(reducer, applyMiddleware(thunk));

log(options, store);

store.dispatch(run('example1'));
store.dispatch(run('example2'));

process.on('exit', () => {
  console.log('## ==== Results ==== ##');
  // const state = options.selector(store.getState());
  // console.log(state);
  //
});
