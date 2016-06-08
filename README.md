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
| Deadlocks | Detected | Undetected |

While there are [plenty](http://jakejs.com/) [of](http://gulpjs.com/) [task-runners](http://www.slant.co/topics/1276) most have an API designed around a very specific paradigm (streams, trees, etc.) and can't handle dependencies with resource-based results (that is to say results which require cleanup after they're used). `bayside` exists to make it easy to inspect and control how large collections of interconnected tasks are run. It has no CLI, and it has no opinion about how your tasks should be run or stored.

Some quick nomenclature to keep things consistent:

**Task**: Representation of work to be done. Every task in `bayside` has a unique string identifier. How that task is run is up to you.

**Registry**: A collection of functions defining the behaviour for a domain of tasks. Includes things like how to run a task and what the dependencies of a given task are.

**Resource**: A stateful result from a task which requires disposing when its no longer needed.

**Dependencies**: Given a particular task, a list of tasks that must successfully complete before the original task can be run.

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

### Metadata

```javascript

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

Sometimes the result of running a task is just a simple value, like a plain JavaScript object. However, other times it can be something that has it's own state - database connections, web servers or file handles. After this kind of task result has been used, it needs to be cleaned up. You can provide a `dispose` handler in your registry for this purpose.

Internally, `bayside` handles all the necessary reference counting ensuring that both: as long as the result of a task is needed, its resource will be kept alive; and when the result is no longer needed, its resource will be disposed.

```javascript
const registry = createRegistry({
  dispose: (id, result) => {
    switch(id) {
    case 'a':
      return result.close();
    default:
      return Promise.resolve();
    }
  },
  run: (id, dependencies) => {
    switch (id) {
    case 'a':
      return db.connect();
    case 'b':
      return dependencies[0].query('some db query');
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
```

Note that when _you_ run a task, `bayside` does not know how long you expect to use the resource for and _DOES NOT_ automatically handle the reference count for that task. If you're thinking of using a resource, consider first if it's possible to make a task that consumes that resource into a concrete result so you do not have to manually manage references yourself.

However, if you do need access to a long-running resource, `bayside` provides you with the mechanism for updating the reference count yourself.

```javascript
// Mark that you want to keep the handle for `a` available.
store.dispatch(refTask('a'))
// Run the task.
store.dispatch(runTask('a')).then((result) => {
  // Do something with the result for as long as you need to.
  // When you're done unref the task. Invoking this will cause the reference
  // count to drop to 0 and the task will be disposed.
  store.dispatch(unrefTask('a'));
});
```

### Orthogonal Tasks

A particular task (and all its transitive dependencies) have to be handled by the same registry. That is to say if `a` depends on `b`, and `b` depends on `c`, then all of `a`, `b` and `c` must be handled by the same registry. However, if you have tasks that are not connected like this you can have each group handled by different registries. Note that the task identifier is independent of the registry and you are still responsible for ensuring uniqueness.

```javascript
// Create registries.
const registry1 = createTaskRegistry(...);
const registry2 = createTaskRegistry(...);

// `registry1` will handle how to manage tasks `a`, `b` and `c`.
const resultA = store.dispatch(runTask(registry1, 'a'));
// `register2` will handle how to manage task `d`.
const resultD = store.dispatch(runTask(registry2, 'd'));
```

### Concurrency Control

Sometimes you may wish to limit how many tasks can run in parallel.

An extremely simple mechanism:

```javascript
const registry = createRegistry({
  // TODO: Finish this.
  schedule: (next, active) => {
    return next.slice(0, Math.max(0, 3 - active.length));
  },
});
```

You can do more complex scheduling using buckets:

```javascript
const registry = createRegistry({
  // TODO: Finish this.
  schedule: (next) => {
    return next.slice(0, 3);
  },
});
```

### Resource Limiting

Sometimes you may wish to control how many resources of one type remain active – e.g. only allow 3 concurrent database sessions. You can use a similar mechanism to concurrency control to achieve this.

```javascript
const registry = createRegistry({
  // TODO: Finish this.
  schedule: (next) => {
    countBy('type', refs);
  }
});
```

### Deadlocks

If you're not careful when customizing the scheduler or you create circular dependencies, you can create deadlocks. Generally, `bayside` is capable of detecting them and will automatically fail any task caught inside a deadlock.

This is a trivial dependency deadlock that `bayside` will detect:

```javascript
const registry = createRegistry({
  run: (id, dependencies) => {
    switch (id) {
    case 'a':
      return Promise.resolve(dependencies[0] + 1);
    default:
      return Promise.reject('No such task.');
    }
  },
  dependencies: (id) => {
    switch (id) {
    case 'a':
      return ['a'];
    default:
      throw new TypeError();
    }
  },
});
```

This is a trivial scheduler deadlock that `bayside` will detect:

```javascript
const registry = createRegistry({
  schedule: () => []
});
```

### Debugging

Because `bayside` uses [redux] under the hood, you can use all the tooling available to the [redux] ecosystem to inspect the state of the system as it runs. For example, you can use [redux-logger] or [redux-cli-logger] to track everything that happens.

```javascript
import createLogger from 'redux-logger';

const logger = createLogger(...);
const store = createStore(reducer, applyMiddleware(thunk, logger));
```

### Reporting

Reporting is a little bit trickier with `bayside`. The only official mechanism to detect changes is by using [store subscription].

```javascript
let state = null;
let oldState = store.getState();
store.subscribe(() => {
  state = store.getState();
  // Report on whatever you want here.
  oldState = state;
});
```

Alternatively, if you're building a reporter that makes use of [react] (either with [react-dom] for the web or [react-blessed] for console), you can use [react-redux] to handle all the necessary state observations.

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

  /**
   * Schedule the next unit of work to be run.
   * @param {Array} tasks List of tasks that are available for running.
   * @returns {Array} List of tasks to be run.
   */
  schedule = (tasks) => tasks,
}
```


[undertaker]: https://github.com/gulpjs/undertaker
[async-done]: https://github.com/gulpjs/async-done
[redux]: https://github.com/reactjs/redux
[redux-thunk]: https://github.com/gaearon/redux-thunk
[store subscription]: http://redux.js.org/docs/api/Store.html#subscribe
[react]: https://facebook.github.io/react/
[react-dom]: https://www.npmjs.com/package/react-dom
[react-blessed]: https://github.com/Yomguithereal/react-blessed
[react-redux]: https://github.com/reactjs/react-redux
[redux-cli-logger]: https://github.com/fasterthanlime/redux-cli-logger
[redux-logger]: https://github.com/evgenyrodionov/redux-logger
