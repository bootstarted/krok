import log from 'npmlog';

export default (options, store) => {
  const logs = {};
  log.heading = 'bayside';
  store.subscribe(() => {
    const state = store.getState();
    const {results, tasks} = options.selector(state);
    Object.keys(results).forEach((id) => {
      const task = results[id];
      const l = (!logs[id]) ? logs[id] = log.newItem(id, 1, 1) : logs[id];
      if (task.status === 'COMPLETE' && l.completed() < 1) {
        const {format = (i) => i} = tasks[id].task;
        if (task.result) {
          l.info(id, format(task.result));
        }
        l.finish();
      } else if (task.status === 'ERROR' && l.completed() < 1) {
        l.error(id, task.error.stack ? task.error.stack : task.error);
        l.finish();
      }
    });
  });

  log.enableColor();
  log.enableUnicode();
  log.enableProgress();
};
