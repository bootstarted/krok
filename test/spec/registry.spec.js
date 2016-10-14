import {expect} from 'chai';
import {createTaskRegistry} from '../../src/registry';

describe('krok', () => {
  describe('.createTaskRegistry', () => {
    it('should fail with an invalid `run` option', () => {
      expect(() => createTaskRegistry({
        run: 5,
        dependencies: () => {},
      })).to.throw(TypeError);
    });
    it('should fail with an invalid `dependencies` option', () => {
      expect(() => createTaskRegistry({
        dependencies: 5,
        run: () => {},
      })).to.throw(TypeError);
    });
  });
});
