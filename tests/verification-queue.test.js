const { oldestCheckedFirst, verificationAgeKey } = require('../server/services/verificationQueue');

describe('verification queue', () => {
  test('never-attempted deals are checked first', () => {
    const queue = oldestCheckedFirst([
      { id: 'recent', price_check_at: 200, last_verify_attempt_at: 200, created_at: 3 },
      { id: 'never', price_check_at: null, last_verify_attempt_at: null, created_at: 2 },
      { id: 'old', price_check_at: 100, last_verify_attempt_at: 100, created_at: 1 },
    ], 3);
    expect(queue.map((d) => d.id)).toEqual(['never', 'old', 'recent']);
  });

  test('failed attempts move a deal back without pretending the price was checked', () => {
    const failed = { id: 'failed', price_check_at: 10, last_verify_attempt_at: 300 };
    const untouched = { id: 'untouched', price_check_at: 100, last_verify_attempt_at: 100 };
    expect(verificationAgeKey(failed)).toBe(300);
    expect(oldestCheckedFirst([failed, untouched], 2).map((d) => d.id)).toEqual(['untouched', 'failed']);
    expect(failed.price_check_at).toBe(10);
  });

  test('respects the batch limit', () => {
    expect(oldestCheckedFirst([{ id: 1 }, { id: 2 }, { id: 3 }], 2)).toHaveLength(2);
  });
});
