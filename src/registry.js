export const createTaskRegistry = ({
  dispose = () => Promise.resolve(),
  selector = (state) => state,
  task = (id) => id,
  dependencies,
  run,
  schedule = (queue) => queue,
}) => {
  // Sanity check.
  if (typeof run !== 'function') {
    throw new TypeError();
  } else if (typeof dependencies !== 'function') {
    throw new TypeError();
  }
  return {
    task,
    dependencies,
    selector,
    schedule,
    dispose,
    run,
  };
};
