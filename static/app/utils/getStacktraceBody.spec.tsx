import getStacktraceBody from 'sentry/utils/getStacktraceBody';

describe('getStacktraceBody', function () {
  const eventException = TestStubs.EventStacktraceException({platform: 'python'});
  const eventMessage = TestStubs.EventStacktraceMessage({platform: 'python'});

  it('formats with an exception', function () {
    const result = getStacktraceBody(eventException);
    expect(result).toEqual([
      `Error: an error occurred
  File "application", line 1, in main
  File "application", line 2, in doThing`,
    ]);
  });

  it('formats with a message', function () {
    const result = getStacktraceBody(eventMessage);
    expect(result).toEqual(['Something is broken']);
  });

  it('returns empty array for empty event entries', function () {
    const result = getStacktraceBody(TestStubs.Event({entries: []}));
    expect(result).toEqual([]);
  });
});
