import {expect} from 'chai';
import {run, fail} from '../../src/actions';
import reducer from '../../src/reducer';
import {createTaskRegistry} from '../../src/registry';
import thunk from 'redux-thunk';
import {
  createStore as createBaseStore,
  applyMiddleware,
} from 'redux';

const createStore = (reducer, state) =>
  createBaseStore(reducer, state, applyMiddleware(thunk));

describe('krok', () => {
  describe('.runTask', () => {
    it('should return successful results from tasks', () => {
      const store = createStore(reducer);
      const config = createTaskRegistry({
        run: (id) => {
          switch (id) {
          case 'a':
            return Promise.resolve(3);
          default:
            return Promise.reject('No such task.');
          }
        },
        dependencies: () => ([]),
      });
      return store.dispatch(run(config, 'a')).then((result) => {
        expect(result).to.equal(3);
      });
    });

    it('should return failure results from tasks', () => {
      const store = createStore(reducer);
      const config = createTaskRegistry({
        run: () => {
          return Promise.reject(5);
        },
        dependencies: () => [],
      });
      return store.dispatch(run(config, 'a')).catch((result) => {
        expect(result).to.equal(5);
      });
    });

    it('should return results using dependencies', () => {
      const store = createStore(reducer);
      const config = createTaskRegistry({
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

      return store.dispatch(run(config, 'b')).then((result) => {
        expect(result).to.equal(8);
      });
    });

    it('should fail if the task is unschedulable', () => {
      const store = createStore(reducer);
      const config = createTaskRegistry({
        schedule: () => [],
        run: (id) => {
          switch (id) {
          case 'a':
            return Promise.resolve(3);
          default:
            return Promise.reject('No such task.');
          }
        },
        dependencies: (id) => {
          switch (id) {
          case 'a':
            return [];
          default:
            throw new TypeError();
          }
        },
      });

      // TODO: Fix checking the positive case.
      return store.dispatch(run(config, 'a')).catch((err) => {
        expect(err).to.be.an.instanceof(Error);
      });
    });

    it('should retry tasks if needed and count their failures', () => {
      let count = 0;
      const store = createStore(reducer);
      const config = createTaskRegistry({
        run: () => {
          ++count;
          if (count < 3) {
            return Promise.reject(5);
          }
          return Promise.resolve(3);
        },
        dependencies: () => [],
        retry: (id, {failures}) => {
          return failures < 3;
        },
      });
      return store.dispatch(run(config, 'a')).then((result) => {
        expect(result).to.equal(3);
        expect(count).to.equal(3);
        expect(store.getState().results.a.failures).to.equal(2);
      });
    });

    it('should allow you to reject tasks in-flight and recover', () => {
      let count = 0;
      const store = createStore(reducer);
      const config = createTaskRegistry({
        run: (id, dependencies) => {
          switch (id) {
          case 'a':
            ++count;
            const result = Promise.resolve(count);
            return result;
          case 'b':
            return Promise.resolve(dependencies[0]);
          default:
            return Promise.reject();
          }
        },
        dependencies: (id) => id === 'b' ? ['a'] :  [],
        retry: (id, {failures}) => {
          return failures < 3;
        },
      });
      return store.dispatch(run(config, 'a')).then(() => {
        store.dispatch(fail(config, 'a', 'TEST_ERROR'));
        return store.dispatch(run(config, 'b')).then((result) => {
          expect(result).to.equal(2);
        });
      });
    });
  });
});
