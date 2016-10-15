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
  TASK_PROGRESS,
  TASK_DISPOSE,
} from './types';
import {handleActions} from 'redux-actions';

export default handleActions({
  [TASK_QUEUE_POP]: (state, {payload: tasks}) => {
    const {queue, todo: oldTodo} = state;
    const todo = oldTodo.slice();
    const used = {};

    tasks.forEach((id) => {
      todo.push(id);
      used[id] = true;
    });

    return {
      ...state,
      todo,
      active: [...state.active, ...todo],
      queue: queue.filter((id) => !used[id]),
    };
  },
  [TASK_QUEUE_PUSH]: (state, {payload: {entry, timestamp}}) => {
    return {
      ...state,
      queue: [
        ...state.queue,
        entry.id,
      ],
      results: {
        ...state.results,
        [entry.id]: {
          ...state.results[entry.id],
          status: 'ENQUEUED',
          queue: entry,
          queued: timestamp,
        },
      },
    };
  },
  [TASK_START]: (state, {payload: {id, timestamp}}) => {
    return {
      ...state,
      todo: state.todo.filter((target) => target !== id),
      running: [
        ...state.running,
        id,
      ],
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          progress: 0,
          status: 'PENDING',
          start: timestamp,
        },
      },
    };
  },
  [TASK_COMPLETE]: (state, {payload: {id, result, timestamp}}) => {
    return {
      ...state,
      todo: state.todo.filter((target) => target !== id),
      running: state.running.filter((target) => target !== id),
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          ready: true,
          status: 'COMPLETE',
          result,
          error: null,
          progress: 1,
          end: timestamp,
        },
      },
    };
  },
  [TASK_FAIL]: (state, {payload: {id, error, retry, timestamp}}) => {
    return {
      ...state,
      todo: state.todo.filter((target) => target !== id),
      running: state.running.filter((target) => target !== id),
      active: state.active.filter((target) => target !== id),
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          ready: false,
          status: 'ERROR',
          error,
          result: null,
          retry,
          failures: state.results[id].failures + 1,
          end: timestamp,
        },
      },
    };
  },
  [TASK_PROGRESS]: (state, {payload: {id, progress}}) => {
    return {
      ...state,
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          progress,
        },
      },
    };
  },
  [TASK_DISPOSE]: (state, {payload: {id}}) => {
    return {
      ...state,
      active: state.active.filter((target) => target !== id),
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          ready: false,
        },
      },
    };
  },
  [TASK_REGISTER]: (state, {payload: {id, task, dependencies, result}}) => {
    return {
      ...state,
      tasks: {
        ...state.tasks,
        [id]: {task, dependencies, result},
      },
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          status: 'REGISTERED',
          failures: 0,
        },
      },
    };
  },
  [TASK_UNREGISTER]: (state, {payload: id}) => {
    const refs = {...state.refs};
    const tasks = {...state.tasks};
    delete refs[id];
    delete tasks[id];
    return {
      ...state,
      refs,
      tasks,
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
}, {
  tasks: {},
  refs: {},
  results: {},
  queue: [],
  todo: [],
  running: [],
  active: [],
});
