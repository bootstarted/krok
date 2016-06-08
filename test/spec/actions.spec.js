import {expect} from 'chai';
import {runTask} from '../../src/actions';
import reducer from '../../src/reducer';
import {createTaskRegistry} from '../../src/registry';
import thunk from 'redux-thunk';
import {
  createStore as createBaseStore,
  applyMiddleware,
} from 'redux';

const createStore = (reducer, state) =>
  createBaseStore(reducer, state, applyMiddleware(thunk));

describe('bayside', () => {
  describe('.runTask', () => {
    it('should return results from tasks', () => {
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
      return store.dispatch(runTask(config, 'a')).then((result) => {
        expect(result).to.equal(3);
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

      return store.dispatch(runTask(config, 'b')).then((result) => {
        expect(result).to.equal(8);
      });
    });
  });
});
