import {
  crc32,
  createCrc32,
  crc32Bytes,
  readCrc32,
  combineCrc32,
  Crc32Error,
  type Crc32State,
} from '@lp-labs/crc32-codec';
const checksum: number = crc32(new Uint8Array(), { polynomial: 'castagnoli' });
const state: Crc32State = createCrc32().snapshot();
const bytes: Uint8Array = crc32Bytes(checksum);
const value: number = combineCrc32(readCrc32(bytes), 0, 0);
const error: 'invalid' | 'limit' = new Crc32Error('invalid', 'x').code;
void state;
void value;
void error;
// @ts-expect-error Non-byte input rejected
crc32('abc');
