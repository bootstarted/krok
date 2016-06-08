import {expect} from 'chai';
import reducer from '../../src/reducer';
import {createAction} from 'redux-actions';

describe('bayside', () => {
  describe('.reducer', () => {
    it('should accept unknown actions', () => {
      const state = {};
      const action = createAction('FOO')();
      expect(reducer(state, action)).to.equal(state);
    });
  });
});
