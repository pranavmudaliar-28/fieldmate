import { initialsOf } from './Avatar';

describe('initialsOf', () => {
  it('takes the first and last initial', () => {
    expect(initialsOf('Priya Nair')).toBe('PN');
    expect(initialsOf('anita kaur')).toBe('AK');
  });

  it('uses one letter for a single name', () => {
    expect(initialsOf('Sam')).toBe('S');
  });

  it('skips middle names rather than crowding the circle', () => {
    expect(initialsOf('Ravi Kumar Tandon')).toBe('RT');
  });

  it('survives stray whitespace and an empty name', () => {
    expect(initialsOf('  Jaya   Desai  ')).toBe('JD');
    expect(initialsOf('   ')).toBe('?');
  });
});
