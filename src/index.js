import {createAction, handleActions} from 'redux-actions';

const prefix = 'my-module';
const TASK_START = `${prefix}/TASK_START`;
const TASK_COMPLETE = `${prefix}/TASK_COMPLETE`;
const TASK_FAIL = `${prefix}/TASK_FAIL`;
const TASK_QUEUE_PUSH = `${prefix}/TASK_QUEUE_PUSH`;
const TASK_QUEUE_POP = `${prefix}/TASK_QUEUE_POP`;
const TASK_REGISTER = `${prefix}/TASK_REGISTER`;
const TASK_UNREGISTER = `${prefix}/TASK_UNREGISTER`;
const TASK_REF = `${prefix}/TASK_REF`;
const TASK_UNREF = `${prefix}/TASK_UNREF`;
const TASK_CONCURRENCY = `${prefix}/TASK_CONCURRENCY`;

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
const refTask = createAction(TASK_REF);

// Decrease the reference count on a task's result. When this hits zero the
// task's result will be disposed and the task will be unregistered.
const unrefTask = createAction(TASK_UNREF);

const runItem = (
  options,
  {id, dependencies, bucket, resolve, reject}
) => (dispatch) => {
  const {task: getTask, run} = options;
  const task = getTask(id);
  const _reject = (error) => {
    dispatch(failTask({id, task, bucket, error, timestamp: Date.now()}));
    reject(error);
  };
  const _resolve = (result) => {
    dispatch(completeTask({id, task, bucket, result, timestamp: Date.now()}));
    resolve(result);
  };
  let result;
  dispatch(startTask({id, task, bucket, timestamp: Date.now()}));
  try {
    result = run(task, dependencies);
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
      return dispose(task, result);
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

  const next = () => dispatch(cleanup(options));

  return result.then(next, next);
};

const runQueue = (options) => (dispatch, getState) => {
  dispatch(unqueueTasks());
  const {selector} = options;
  const {processing} = selector(getState());
  processing.forEach((task) => {
    dispatch(runItem(options, task));
  });
};

export const runTask = (options, id) => (dispatch, getState) => {
  const {
    task: getTask,
    dependencies: getDependencies,
    bucket: getBucket,
    selector,
  } = options;
  const {promises} = selector(getState());
  if (promises[id]) {
    return promises[id];
  }
  const task = getTask(id);
  const bucket = getBucket(task);
  const dependencies = getDependencies(task).map((id) => {
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
      dispatch(queueTask({id, bucket, dependencies, resolve, reject}));
      dispatch(runQueue(options));
    });
  }, (err) => {
    console.log('WTF?!')
    console.log(err.stack);
    const error = new Error('Dependency error.');
    dispatch(failTask({id, error, timestamp: Date.now()}));
    dispatch(cleanup(options, [id]));
    throw error;
  });
  dispatch(registerTask({id, result}));
  return result;
};

export const reducer = handleActions({
  [TASK_QUEUE_POP]: (state) => {
    const {queue, refs, limits, processing, results} = state;

    const buckets = {};
    Object.keys(refs).forEach((id) => {
      if (refs[id] > 0 && results[id]) {
        const {bucket} = results[id];
        if (bucket in buckets) {
          ++buckets[bucket];
        } else {
          buckets[bucket] = 1;
        }
      }
    });

    // Only select those tasks which, when started, would not violate any of
    // the set limits.
    const available = [];
    const unavailable = [];

    queue.forEach((task) => {
      const {bucket} = task;
      if (limits[bucket] && buckets[bucket]) {
        ++buckets[bucket];
        if (buckets[bucket] < limits[bucket]) {
          available.push(task);
        } else {
          unavailable.push(task);
        }
      } else {
        available.push(task);
      }
    });

    // TODO: Implement desired amount of parallelism here. Right now everything
    // is simply maximally parallel.

    const nextQueue = unavailable;
    const nextProcessing = [...processing, ...available];

    return {
      ...state,
      processing: nextProcessing,
      queue: nextQueue,
    };
  },
  [TASK_QUEUE_PUSH]: (state, {payload: entry}) => {
    return {
      ...state,
      queue: [
        ...state.queue,
        entry,
      ],
    };
  },
  [TASK_START]: (state, {payload: {id, timestamp}}) => {
    return {
      ...state,
      results: {
        ...state.results,
        [id]: {
          status: 'PENDING',
          start: timestamp,
        },
      },
    };
  },
  [TASK_COMPLETE]: (state, {payload: {id, result, bucket, timestamp}}) => {
    const processing = state.processing.filter(({id: target}) => id !== target);
    return {
      ...state,
      processing,
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          status: 'COMPLETE',
          result,
          end: timestamp,
          duration: timestamp - state.results[id].start,
          bucket,
        },
      },
    };
  },
  [TASK_FAIL]: (state, {payload: {id, error, bucket, timestamp}}) => {
    const processing = state.processing.filter(({id: target}) => id !== target);
    if (!state.results[id]) {
      return {
        ...state,
        processing,
        results: {
          ...state.results,
          [id]: {
            status: 'ERROR',
            timestamp,
            duration: 0,
            error,
            bucket,
          },
        },
      };
    }
    return {
      ...state,
      processing,
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          status: 'ERROR',
          error,
          end: timestamp,
          duration: timestamp - state.results[id].start,
          bucket,
        },
      },
    };
  },
  [TASK_REGISTER]: (state, {payload: {id, result}}) => {
    return {
      ...state,
      promises: {
        ...state.promises,
        [id]: result,
      },
    };
  },
  [TASK_UNREGISTER]: (state, {payload: id}) => {
    const promises = {...state.promises};
    const refs = {...state.refs};
    delete promises[id];
    delete refs[id];
    return {
      ...state,
      refs,
      promises,
    };
  },
  [TASK_REF]: (state, {payload: id}) => {
    return {
      ...state,
      refs: {
        ...state.refs,
        [id]: (state.refs[id] || 0) + 1,
      },
    };
  },
  [TASK_UNREF]: (state, {payload: id}) => {
    return {
      ...state,
      refs: {
        ...state.refs,
        [id]: (state.refs[id] || 0) - 1,
      },
    };
  },
  [TASK_CONCURRENCY]: (state, {payload: concurrency}) => {
    return {
      ...state,
      concurrency,
    };
  },
}, {
  promises: {},
  refs: {},
  results: {},
  queue: [],
  processing: [],
  concurrency: Infinity,
  limits: {},
});
