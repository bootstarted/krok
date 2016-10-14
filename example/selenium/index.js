
import {
  run,
  progress,
  fail,
  reducer as taskReducer,
  createTaskRegistry,
} from '../../src';
import thunk from 'redux-thunk';
import {createStore, combineReducers, applyMiddleware} from 'redux';
import log from './log';

// Selenium providers.
import * as browserStack from './cloud/browserstack';
import * as sauceLabs from './cloud/saucelabs';
import * as local from './cloud/local';

// Basic world.
import * as world from './world';

// Tests
import * as tests from './test/standalone.test';

const index = {
  ...browserStack,
  ...sauceLabs,
  ...local,
  ...world,
  ...tests,
};

const options = createTaskRegistry({
  task: (id) => (dispatch) => {
    const [name, context] = id.split('@', 2);
    return {
      ...index[name],
      id,
      name,
      context,
      progress: (amount) => dispatch(progress(id, amount)),
      fail: (error) => dispatch(fail(id, error)),
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
  selector: (state) => state.krok,
  timeout: (task) => {
    const {timeout} = task;
    if (typeof timeout === 'function') {
      return timeout(task);
    }
    return timeout || 6000;
  },
  retry: (task, {failures}) => {
    return failures < 2;
  },
});

const go = (id) => run(options, id);

const reducer = combineReducers({
  krok: taskReducer,
});

const store = createStore(reducer, applyMiddleware(thunk));

log(options, store);

store.dispatch(go('example1'));
store.dispatch(go('example2'));

process.on('exit', () => {
  console.log('## ==== Results ==== ##');
  // const state = options.selector(store.getState());
  // console.log(state);
  //
});
