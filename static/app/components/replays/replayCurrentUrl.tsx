import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  const frames = replay?.getNavigationFrames();

  const url = useMemo(() => {
    try {
      return getCurrentUrl(frames, currentTime);
    } catch (err) {
      Sentry.captureException(err);
      return '';
    }
  }, [frames, currentTime]);

  if (!replay || !url) {
    return (
      <TextCopyInput size="sm" disabled>
        {''}
      </TextCopyInput>
    );
  }

  return <TextCopyInput size="sm">{url}</TextCopyInput>;
}

export default ReplayCurrentUrl;
