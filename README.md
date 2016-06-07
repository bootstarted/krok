# bayside

Unopinionated task and resource management powered by redux.

![build status](http://img.shields.io/travis/metalabdesign/bayside/master.svg?style=flat)
![coverage](http://img.shields.io/coveralls/metalabdesign/bayside/master.svg?style=flat)
![license](http://img.shields.io/npm/l/bayside.svg?style=flat)
![version](http://img.shields.io/npm/v/bayside.svg?style=flat)
![downloads](http://img.shields.io/npm/dm/bayside.svg?style=flat)

## Overview



## Installation

```sh
npm install --save bayside
```

## Usage

```javascript
import {runTask, reducer} from 'bayside';
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
```
