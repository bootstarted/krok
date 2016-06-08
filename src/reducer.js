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
  [TASK_QUEUE_POP]: (state) => {
    const {queue, processing} = state;

    const nextQueue = [];
    const nextProcessing = [...processing, ...queue];

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
}, {
  promises: {},
  refs: {},
  results: {},
  queue: [],
  processing: [],
});
