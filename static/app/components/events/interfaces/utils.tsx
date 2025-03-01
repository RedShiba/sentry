import * as Sentry from '@sentry/react';
import compact from 'lodash/compact';
import isString from 'lodash/isString';
import uniq from 'lodash/uniq';
import * as qs from 'query-string';

import getThreadException from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import {FILTER_MASK} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {Frame, PlatformType} from 'sentry/types';
import {Image} from 'sentry/types/debugImage';
import {EntryRequest, EntryThreads, EntryType, Event, Thread} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {fileExtensionToPlatform, getFileExtension} from 'sentry/utils/fileExtension';

/**
 * Attempts to escape a string from any bash double quote special characters.
 */
function escapeBashString(v: string) {
  return v.replace(/(["$`\\])/g, '\\$1');
}

// TODO(dcramer): support cookies
export function getCurlCommand(data: EntryRequest['data']) {
  let result = 'curl';

  if (defined(data.method) && data.method !== 'GET') {
    result += ' \\\n -X ' + data.method;
  }

  // TODO(benvinegar): just gzip? what about deflate?
  const compressed = data.headers?.find(
    h => h[0] === 'Accept-Encoding' && h[1].includes('gzip')
  );
  if (compressed) {
    result += ' \\\n --compressed';
  }

  // sort headers
  const headers =
    data.headers?.sort(function (a, b) {
      return a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1;
    }) ?? [];

  for (const header of headers) {
    result += ' \\\n -H "' + header[0] + ': ' + escapeBashString(header[1] + '') + '"';
  }

  if (defined(data.data)) {
    switch (data.inferredContentType) {
      case 'application/json':
        result += ' \\\n --data "' + escapeBashString(JSON.stringify(data.data)) + '"';
        break;
      case 'application/x-www-form-urlencoded':
        result +=
          ' \\\n --data "' +
          escapeBashString(qs.stringify(data.data as {[key: string]: any})) +
          '"';
        break;

      default:
        if (isString(data.data)) {
          result += ' \\\n --data "' + escapeBashString(data.data) + '"';
        } else if (Object.keys(data.data).length === 0) {
          // Do nothing with empty object data.
        } else {
          Sentry.withScope(scope => {
            scope.setExtra('data', data);
            Sentry.captureException(new Error('Unknown event data'));
          });
        }
    }
  }

  result += ' \\\n "' + getFullUrl(data) + '"';
  return result;
}

export function stringifyQueryList(query: string | [key: string, value: string][]) {
  if (isString(query)) {
    return query;
  }

  const queryObj: Record<string, string[]> = {};
  for (const kv of query) {
    if (kv !== null && kv.length === 2) {
      const [key, value] = kv;
      if (value !== null) {
        if (Array.isArray(queryObj[key])) {
          queryObj[key].push(value);
        } else {
          queryObj[key] = [value];
        }
      }
    }
  }
  return qs.stringify(queryObj);
}

export function getFullUrl(data: EntryRequest['data']): string | undefined {
  let fullUrl = data?.url;
  if (!fullUrl) {
    return fullUrl;
  }

  if (data?.query?.length) {
    fullUrl += '?' + stringifyQueryList(data.query);
  }

  if (data.fragment) {
    fullUrl += '#' + data.fragment;
  }

  return escapeBashString(fullUrl);
}

/**
 * Converts an object of body/querystring key/value pairs
 * into a tuple of [key, value] pairs, and sorts them.
 *
 * This handles the case for query strings that were decoded like so:
 *
 *   ?foo=bar&foo=baz => { foo: ['bar', 'baz'] }
 *
 * By converting them to [['foo', 'bar'], ['foo', 'baz']]
 */
export function objectToSortedTupleArray(obj: Record<string, string | string[]>) {
  return Object.keys(obj)
    .reduce<[string, string][]>((out, k) => {
      const val = obj[k];
      return out.concat(
        Array.isArray(val)
          ? val.map(v => [k, v]) // key has multiple values (array)
          : ([[k, val]] as [string, string][]) // key has single value
      );
    }, [])
    .sort(function ([keyA, valA], [keyB, valB]) {
      // if keys are identical, sort on value
      if (keyA === keyB) {
        return valA < valB ? -1 : 1;
      }

      return keyA < keyB ? -1 : 1;
    });
}

// for context summaries and avatars
export function removeFilterMaskedEntries<T extends Record<string, any>>(rawData: T): T {
  const cleanedData: Record<string, any> = {};
  for (const key of Object.getOwnPropertyNames(rawData)) {
    if (rawData[key] !== FILTER_MASK) {
      cleanedData[key] = rawData[key];
    }
  }
  return cleanedData as T;
}

export function formatAddress(address: number, imageAddressLength: number | undefined) {
  return `0x${address.toString(16).padStart(imageAddressLength ?? 0, '0')}`;
}

export function parseAddress(address?: string | null) {
  if (!address) {
    return 0;
  }

  try {
    return parseInt(address, 16) || 0;
  } catch (_e) {
    return 0;
  }
}

export function getImageRange(image: Image) {
  // The start address is normalized to a `0x` prefixed hex string. The event
  // schema also allows ingesting plain numbers, but this is converted during
  // ingestion.
  const startAddress = parseAddress(image?.image_addr);

  // The image size is normalized to a regular number. However, it can also be
  // `null`, in which case we assume that it counts up to the next image.
  const endAddress = startAddress + (image?.image_size || 0);

  return [startAddress, endAddress];
}

export function parseAssembly(assembly: string | null) {
  let name: string | undefined;
  let version: string | undefined;
  let culture: string | undefined;
  let publicKeyToken: string | undefined;

  const pieces = assembly ? assembly.split(',') : [];

  if (pieces.length > 0) {
    name = pieces[0];
  }

  for (let i = 1; i < pieces.length; i++) {
    const [key, value] = pieces[i].trim().split('=');

    // eslint-disable-next-line default-case
    switch (key) {
      case 'Version':
        version = value;
        break;
      case 'Culture':
        if (value !== 'neutral') {
          culture = value;
        }
        break;
      case 'PublicKeyToken':
        if (value !== 'null') {
          publicKeyToken = value;
        }
        break;
    }
  }

  return {name, version, culture, publicKeyToken};
}

export function stackTracePlatformIcon(platform: PlatformType, frames: Frame[]) {
  const fileExtensions = uniq(
    compact(frames.map(frame => getFileExtension(frame.filename ?? '')))
  );

  if (fileExtensions.length === 1) {
    const newPlatform = fileExtensionToPlatform(fileExtensions[0]);

    return newPlatform ?? platform;
  }

  return platform;
}

export function isStacktraceNewestFirst() {
  const user = ConfigStore.get('user');
  // user may not be authenticated

  if (!user) {
    return true;
  }

  switch (user.options.stacktraceOrder) {
    case 2:
      return true;
    case 1:
      return false;
    case -1:
    default:
      return true;
  }
}

export function getCurrentThread(event: Event) {
  const threads = event.entries?.find(entry => entry.type === EntryType.THREADS) as
    | EntryThreads
    | undefined;
  return threads?.data.values?.find(thread => thread.current);
}

export function getThreadById(event: Event, tid?: number) {
  const threads = event.entries?.find(entry => entry.type === EntryType.THREADS) as
    | EntryThreads
    | undefined;
  return threads?.data.values?.find(thread => thread.id === tid);
}

export function inferPlatform(event: Event, thread?: Thread): PlatformType {
  const exception = getThreadException(event, thread);
  let exceptionFramePlatform: Frame | undefined = undefined;

  for (const value of exception?.values ?? []) {
    exceptionFramePlatform = value.stacktrace?.frames?.find(frame => !!frame.platform);
    if (exceptionFramePlatform) {
      break;
    }
  }

  if (exceptionFramePlatform?.platform) {
    return exceptionFramePlatform.platform;
  }

  const threadFramePlatform = thread?.stacktrace?.frames?.find(frame => !!frame.platform);

  if (threadFramePlatform?.platform) {
    return threadFramePlatform.platform;
  }

  return event.platform ?? 'other';
}
