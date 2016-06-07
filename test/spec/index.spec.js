// TODO:

import {runTask, reducer} from '../../src';
import thunk from 'redux-thunk';
import {createStore, combineReducers, applyMiddleware} from 'redux';


const store = createStore(reducer, applyMiddleware(thunk));

const config = {
  run: (id, dependencies) => {
    switch (id) {
    case 'a':
      return Promise.resolve(3);
    case 'b':
      return Promise.resolve(5 + dependencies[0]);
    default:
      return Promise.reject('No such task.');
    }
  },
  dependencies: (id) => {
    switch (id) {
    case 'a':
      return [];
    case 'b':
      return ['a'];
    default:
      throw new TypeError();
    }
  },
};


store.dispatch(runTask(config, 'b'));
