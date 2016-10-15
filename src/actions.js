import {createAction} from 'redux-actions';
import {
  TASK_QUEUE_POP,
  TASK_QUEUE_PUSH,
  TASK_START,
  TASK_COMPLETE,
  TASK_FAIL,
  TASK_DISPOSE,
  TASK_REGISTER,
  TASK_UNREGISTER,
  TASK_REF,
  TASK_UNREF,
  TASK_PROGRESS,
} from './types';

// Task has begun processing.
const startTask = createAction(TASK_START);

// Task has completed processing. Result of the task is available.
const completeTask = createAction(TASK_COMPLETE);

// Task has failed. Error from the failure is available. You can invoke this
// manually to fail a task _after_ it has initially succeeded, signifying
// the resource that belongs to that task is no longer valid.
const failTask = createAction(TASK_FAIL);

// Task has been disposed. Any resource that was associated with it is no
// longer valid and the task will have to be re-run if it is needed again.
// This is only necessary for succeeded tasks - those which are failed are
// never ready to begin with.
const disposeTask = createAction(TASK_DISPOSE);

// Task is ready to be processed. All dependencies have been completed or
// failed.
const queueTask = createAction(TASK_QUEUE_PUSH);

// Move list of tasks from the pending queue into active processing.
const unqueueTasks = createAction(TASK_QUEUE_POP);

// Mark a task as having been requested. Includes a promise representing the
// result of the task.
const registerTask = createAction(TASK_REGISTER);

// Mark a task's result as no longer being needed.
const unregisterTask = createAction(TASK_UNREGISTER);

// Update the progress information for a task.
const progressTask = createAction(TASK_PROGRESS);

// Increase the reference count on a task's result. While this is positive
// the task result will be held alive.
export const refTask = createAction(TASK_REF);

// Decrease the reference count on a task's result. When this hits zero the
// task's result will be disposed and the task will be unregistered.
export const unrefTask = createAction(TASK_UNREF);

// Allow registry functions to gain `dispatch` and `getState`.
const thunkable = (res, dispatch, getState) => {
  if (typeof res === 'function') {
    return res(dispatch, getState);
  }
  return res;
};

const runItem = (
  options,
  {id, resolve, reject} /* dependencies provided here too */
) => (dispatch, getState) => {
  let timedOut = false;
  let complete = false;
  const {run, selector, dispose, timeout, retry} = options;
  const {tasks, results} = selector(getState());
  const {task, dependencies} = tasks[id];
  const _reject = (error) => {
    dispatch(failTask({
      id,
      task,
      error,
      retry: retry(task, results[id], error),
      timestamp: Date.now(),
    }));
    reject(error);
  };
  const _resolve = (result) => {
    complete = true;
    // If we manage to resolve after we've already timed out it means the
    // promise will have been rejected and resource cleanup will NOT be
    // triggered by default; since the result will never be used, just cleanup
    // the resource immediately.
    if (timedOut) {
      dispatch(disposeTask({id}));
      thunkable(dispose(task, result), dispatch, getState);
    } else {
      dispatch(completeTask({id, task, result, timestamp: Date.now()}));
      resolve(result);
    }
  };
  let result;

  // The failure check here is to detect resource failures. Tasks which have
  // initially succeeded (and so their promise has resolved) but whose state
  // is now failure. For the same reason the dependencies are re-collected.
  // By the time a task has run something it depends on could have been updated
  // and the result of that will not be reflected in the original promise.
  // It's a complex, annoying edge case but it does exist.
  const failures = [];
  const deps = dependencies.map((id) => {
    if (!results[id].ready) {
      failures.push(results[id].error);
      return null;
    }
    return results[id].result;
  });
  if (failures.length > 0) {
    _reject(new Error());
    return;
  }
  const wait = thunkable(timeout(task), dispatch, getState);
  dispatch(startTask({id, task, timestamp: Date.now()}));
  if (timeout > 0) {
    /* global setTimeout */
    setTimeout(() => {
      if (complete) {
        return;
      }
      complete = timedOut = true;
      const error = new Error('Timeout exceeded.');
      _reject(error);
    }, wait);
  }
  try {
    result = thunkable(run(task, deps), dispatch, getState);
  } catch (err) {
    _reject(err);
    return;
  }
  if (typeof result.then !== 'function') {
    _reject(new TypeError('Did not return `Promise`.'));
  } else {
    result.then(_resolve, _reject);
  }
};

const cleanup = (options, todo) => (dispatch, getState) => {
  const {
    dispose,
    selector,
  } = options;
  const {refs, tasks} = selector(getState());

  // Find things which need disposing.
  const all = (todo || Object.keys(refs)).filter((id) => !refs[id]);

  // If there's nothing to do, then bail early.
  if (all.length === 0) {
    return dispatch(runQueue(options)); // eslint-disable-line
  }

  // Go through every task whose result needs disposing.
  const result = Promise.all(all.map((id) => {
    const {task, dependencies, result} = tasks[id];
    const done = () => {
      // Go through all our dependencies and remove a ref for each one.
      // The ref here is originally created in `run`.
      dependencies.forEach((dep) => {
        dispatch(unrefTask(dep));
      });
      // Destroy the task.
      dispatch(unregisterTask(id));
    };

    const work = (err) => (result) => {
      // Dispose it.
      dispatch(disposeTask({id}));
      return thunkable(dispose(task, result, err), dispatch, getState);
    };

    // Get the result from the task.
    return result.then(work(false), work(true)).then(
      (result) => {
        done();
        return result;
      },
      (err) => {
        done();
        throw err;
      }
    );
  }));

  // Keep cleaning up until there's nothing left to do.
  const next = () => dispatch(cleanup(options));

  return result.then(next, next);
};

const schedule = (options) => (dispatch, getState) => {
  const {selector, schedule} = options;
  const {queue, active, results} = selector(getState());
  if (queue.length > 0) {
    const tasks = thunkable(schedule(queue), dispatch, getState);

    // TODO: What should happen if the scheduler returns an invalid task?
    // Ignore it or bail on error or nothing?
    // if (tasks.some((id) => !results[id])) {};

    // Detect deadlock conditions. If there are no tasks to be scheduled AND
    // there are no tasks currently processing AND there is work left to be done
    // then we've hit an impasse. The rationale is that if there are no tasks
    // currently processing then the scheduler will not be invoked again and
    // thus everything will simply stop. In this case the queue is simply
    // fushed and all active items are rejected.
    if (
      tasks.length === 0 &&
      active.length === 0 &&
      queue.length > 0
    ) {
      dispatch(unqueueTasks(queue));
      const error = new Error('Deadlock.');
      queue.forEach((id) => {
        results[id].queue.reject(error);
        dispatch(failTask({id, error, timestamp: Date.now()}));
      });
    } else {
      dispatch(unqueueTasks(tasks));
    }
  }
};

const runQueue = (options) => (dispatch, getState) => {
  dispatch(schedule(options));
  const {selector} = options;
  const {todo, results} = selector(getState());
  todo.forEach((id) => {
    dispatch(runItem(options, results[id].queue));
  });
};

export const fail = (options, id, error) => (dispatch, getState) => {
  const {selector, retry} = options;
  const {tasks, results} = selector(getState());
  return dispatch(failTask({
    id,
    task: tasks[id],
    error,
    retry: retry(tasks[id], results[id], error),
    timestamp: Date.now(),
  }));
};

export const progress = (options, id, progress) => (dispatch) => {
  return dispatch(progressTask({
    id,
    progress,
  }));
};

export const run = (options, id) => (dispatch, getState) => {
  const {
    task: getTask,
    dependencies: getDependencies,
    selector,
  } = options;
  const {tasks, results} = selector(getState());
  if (tasks[id] && (!results[id] || !results[id].retry)) {
    // Tasks that initially succeeded can later fail and this check is there
    // to ensure that such "subsequently failed" tasks are rejected properly.
    if (results[id] && results[id].status === 'ERROR') {
      return Promise.reject(results[id].error);
    }
    return tasks[id].result;
  }
  const task = thunkable(getTask(id), dispatch, getState);
  const dependencies = thunkable(getDependencies(task), dispatch, getState);
  const result = Promise.all(dependencies.map((id) => {
    dispatch(refTask(id));
    return dispatch(run(options, id));
  })).then((dependencies) => {
    return new Promise((_resolve, _reject) => {
      const resolve = (result) => {
        dispatch(cleanup(options, [id]));
        _resolve(result);
      };
      const reject = (error) => {
        const {results} = selector(getState());
        if (results[id].retry) {
          dispatch(runItem(options, {id, resolve, reject}));
        } else {
          dispatch(cleanup(options, [id]));
          _reject(error);
        }
      };
      dispatch(queueTask({
        entry: {id, dependencies, resolve, reject},
        timestamp: Date.now(),
      }));
      dispatch(runQueue(options));
    });
  }, (error) => {
    dispatch(failTask({id, error, timestamp: Date.now()}));
    dispatch(cleanup(options, [id]));
    throw error;
  });
  dispatch(registerTask({id, task, dependencies, result}));
  return result;
};
