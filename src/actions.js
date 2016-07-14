import {createAction} from 'redux-actions';
import {
  TASK_QUEUE_POP,
  TASK_QUEUE_PUSH,
  TASK_START,
  TASK_COMPLETE,
  TASK_FAIL,
  TASK_REGISTER,
  TASK_UNREGISTER,
  TASK_REF,
  TASK_UNREF,
} from './types';

// Task has begun processing.
const startTask = createAction(TASK_START);

// Task has completed processing. Result of the task is available.
const completeTask = createAction(TASK_COMPLETE);

// Task has failed. Error from the failure is available.
const failTask = createAction(TASK_FAIL);

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
  {id, dependencies, resolve, reject}
) => (dispatch, getState) => {
  const {task: getTask, run} = options;
  const task = thunkable(getTask(id), dispatch, getState);
  const _reject = (error) => {
    dispatch(failTask({id, task, error, timestamp: Date.now()}));
    reject(error);
  };
  const _resolve = (result) => {
    dispatch(completeTask({id, task, result, timestamp: Date.now()}));
    resolve(result);
  };
  let result;
  dispatch(startTask({id, task, timestamp: Date.now()}));
  try {
    result = thunkable(run(task, dependencies), dispatch, getState);
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

const cleanup = (options, tasks) => (dispatch, getState) => {
  const {
    task: getTask,
    dependencies: getDependencies,
    dispose,
    selector,
  } = options;
  const {refs, promises} = selector(getState());

  // Find things which need disposing.
  const all = (tasks || Object.keys(refs)).filter((id) => !refs[id]);

  // If there's nothing to do, then bail early.
  if (all.length === 0) {
    return Promise.resolve();
  }

  // Go through every task whose result needs disposing.
  const result = Promise.all(all.map((id) => {
    const task = getTask(id);
    const done = () => {
      // Go through all our dependencies and remove a ref for each one.
      // The ref here is originally created in `runTask`.
      getDependencies(task).forEach((dep) => {
        dispatch(unrefTask(dep));
      });
      // Destroy the task.
      dispatch(unregisterTask(id));
    };
    // Get the result from the task.
    return promises[id].then((result) => {
      // Dispose it.
      return thunkable(dispose(task, result), dispatch, getState);
    }).then(
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
  const {todo, queue, results} = selector(getState());
  const tasks = thunkable(schedule(queue), dispatch, getState);

  // TODO: What should happen if the scheduler returns an invalid task?
  // Ignore it or bail on error or nothing?
  // if (tasks.some((id) => !results[id])) {};

  // Detect deadlock conditions. If there are no tasks to be scheduled AND
  // there are no tasks currently processing AND there is work left to be done
  // then we've hit an impasse. The rationale is that if there are no tasks
  // currently processing then the scheduler will not be invoked again and thus
  // everything will simply stop. In this case the queue is simply fushed and
  // all active items are rejected.
  if (tasks.length === 0 && todo.length === 0 && queue.length > 0) {
    dispatch(unqueueTasks(queue));
    const error = new Error('Deadlock.');
    queue.forEach((id) => {
      results[id].queue.reject(error);
      dispatch(failTask({id, error, timestamp: Date.now()}));
    });
  } else {
    dispatch(unqueueTasks(tasks));
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

export const runTask = (options, id) => (dispatch, getState) => {
  const {
    task: getTask,
    dependencies: getDependencies,
    selector,
  } = options;
  const {promises} = selector(getState());
  if (promises[id]) {
    return promises[id];
  }
  const task = thunkable(getTask(id, getState), dispatch, getState);
  const dependencies = thunkable(getDependencies(task), dispatch, getState)
    .map((id) => {
      dispatch(refTask(id));
      return dispatch(runTask(options, id));
    });
  const result = Promise.all(dependencies).then((dependencies) => {
    return new Promise((_resolve, _reject) => {
      const resolve = (result) => {
        dispatch(cleanup(options, [id]));
        _resolve(result);
      };
      const reject = (error) => {
        dispatch(cleanup(options, [id]));
        _reject(error);
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
  dispatch(registerTask({id, result}));
  return result;
};
