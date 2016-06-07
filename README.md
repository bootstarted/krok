# bayside

Complete task and resource management powered by redux.

![build status](http://img.shields.io/travis/metalabdesign/bayside/master.svg?style=flat)
![coverage](http://img.shields.io/coveralls/metalabdesign/bayside/master.svg?style=flat)
![license](http://img.shields.io/npm/l/bayside.svg?style=flat)
![version](http://img.shields.io/npm/v/bayside.svg?style=flat)
![downloads](http://img.shields.io/npm/dm/bayside.svg?style=flat)

## Overview

| Feature | bayside | [undertaker] |
| ------- | ------- | ------------ |
| Async primitive   | Promise | [async-done]   |
| Resource management | Yes | No |
| Result forwarding | Yes | No |
| Task registry | External | Internal |
| State management | [redux] | Internal |
| Concurrency | Controlled | Unlimited |

While there are [plenty](http://jakejs.com/) [of](http://gulpjs.com/) [task-runners](http://www.slant.co/topics/1276) most have an API designed around a very specific paradigm (streams, trees, etc.) and can't handle dependencies with resource-based results (that is to say results which require cleanup after they're used). `bayside` exists to make it easy to inspect and control how large collections of interconnected tasks are run. It has no CLI, and it has no opinion about how your tasks should be run or stored.

## Installation

Install `bayside` and its dependencies:

```sh
npm install --save bayside redux redux-thunk
```

## Usage

### Simple

If you have a fixed set of tasks to run you can simply encode all of them directly.

```javascript
import {runTask, reducer, createRegistry} from 'bayside';
import thunk from 'redux-thunk';
import {createStore, applyMiddleware} from 'redux';

const store = createStore(reducer, applyMiddleware(thunk));

const registry = createRegistry({
  // Called whenever a task has to be run. Return a promise representing the
  // result of running the task.
  run: (id, dependencies) => {
    switch (id) {
    case 'a':
      // Perform computation for task `a`.
      return Promise.resolve(3);
    case 'b':
      // Perform computation for task `b`.
      return Promise.resolve(5 + dependencies[0]);
    default:
      // Trying to run any other task is failure.
      return Promise.reject('No such task.');
    }
  },
  // Called whenever dependencies need to be computed for a task. Return an
  // array of other tasks that need to be run.
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
});

// Run the task.
const result = store.dispatch(runTask(registry, 'b'));

// Do something with the result.
result.then((b) => console.log('Task result:', b));
```

### Additional State

Sometimes you will want to do things with state.

```javascript
import {runTask, reducer as taskReducer, createRegistry} from 'bayside';
import thunk from 'redux-thunk';
import {createStore, combineReducers, applyMiddleware} from 'redux';

// Create your application's reducer.
const appReducer = handleActions({

});

// Create the combined reducer.
const reducer = combineReducers({
  tasks: taskReducer,
  app: appReducer,
});

// Create a selector to pick out the bayside state.
const selector = (state) => state.tasks;

const store = createStore(reducer, applyMiddleware(thunk));

const registry = createRegistry({
  selector,
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
});


const result = store.dispatch(runTask(registry, 'b'));
result.then((b) => console.log('Task result:', b));
```

### Resource Management

### Orthogonal Tasks

```javascript
const result = store.dispatch(runTask(registryA, 'a'));
const result = store.dispatch(runTask(registryB, 'b'));
```

### Debugging

Because `bayside` uses [redux] under the hood, you can use all the tooling available to the [redux] ecosystem to inspect your tasks.

```javascript

```

## Configuration

The options (and defaults) to `createTaskRegistry` are described below:

```javascript
{
  /**
   * Clean up the result produced by a task. This is called whenever the
   * resource created by your task is no longer needed.
   * @param {Any} task Task whose resource needs disposing.
   * @param {Any} value The resource created by the task.
   * @returns {Promise} The result of disposing the resource.
   */
  dispose = (task, value) => Promise.resolve(),

  /**
   * Fetch the part of the global redux state atom that has the `bayside` state.
   * You can use this to combine `bayside` with other redux reducers.
   * @param {Object} state Global redux state atom.
   * @returns {Object} The `bayside` state atom.
   */
  selector = (state) => state,

  /**
   * Fetch a task. Internally `bayside` only uses `id` to track tasks, but you
   * may wish to attach additional data to a particular task. Whatever you
   * return here will be passed as the `task` argument to the other registry
   * functions.
   * @param {String} id Task identifier.
   * @returns {Any} Task representation for given identifier.
   */
  task = (id) => id,

  /**
   * Fetch the list of dependencies for a task.
   * @param {Any} task The current task.
   * @returns {Array} List of dependencies.
   */
  dependencies = (task) => [],

  /**
   * Execute the task.
   * @param {Any} task The current task.
   * @returns {Promise} The result of executing the task.
   */
  run = (task) => Promise.resolve(),

  // TODO: Think on this.
  bucket = (id) => id,
}
```


[undertaker]: https://github.com/gulpjs/undertaker
[async-done]: https://github.com/gulpjs/async-done
[redux]: https://github.com/reactjs/redux
[redux-thunk]: https://github.com/gaearon/redux-thunk
