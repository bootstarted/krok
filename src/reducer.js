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
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          status: 'PENDING',
          start: timestamp,
        },
      },
    };
  },
  [TASK_COMPLETE]: (state, {payload: {id, result, bucket, timestamp}}) => {
    return {
      ...state,
      todo: state.todo.filter((target) => target !== id),
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          status: 'COMPLETE',
          result,
          end: timestamp,
          bucket,
        },
      },
    };
  },
  [TASK_FAIL]: (state, {payload: {id, error, bucket, timestamp}}) => {
    return {
      ...state,
      todo: state.todo.filter((target) => target !== id),
      results: {
        ...state.results,
        [id]: {
          ...state.results[id],
          status: 'ERROR',
          error,
          end: timestamp,
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
}, {
  promises: {},
  refs: {},
  results: {},
  queue: [],
  todo: [],
});
