import {CheckInStatus} from 'sentry/views/monitors/types';

export type TimeWindow = '1h' | '24h' | '7d' | '30d';

export interface TimeWindowOptions {
  /**
   * The time format used for the cursor label
   */
  cursorLabelFormat: string;
  /**
   * Props to pass to <DateTime> when displaying a time marker
   */
  dateTimeProps: {dateOnly?: boolean; timeOnly?: boolean};
  /**
   * The elapsed minutes based on the selected resolution
   */
  elapsedMinutes: number;
  /**
   * The interval between each grid line and time label in minutes
   */
  timeMarkerInterval: number;
}

export type TimeWindowData = Record<TimeWindow, TimeWindowOptions>;

export type MonitorBucketData = [timestamp: number, envData: MonitorBucketEnvMapping][];

export interface JobTickData {
  endTs: number;
  envMapping: MonitorBucketEnvMapping;
  roundedLeft: boolean;
  roundedRight: boolean;
  startTs: number;
  width: number;
}

export type StatsBucket = {
  [CheckInStatus.OK]: number;
  [CheckInStatus.MISSED]: number;
  [CheckInStatus.TIMEOUT]: number;
  [CheckInStatus.ERROR]: number;
};

export type MonitorBucketEnvMapping = Record<string, StatsBucket>;
