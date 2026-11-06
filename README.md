# @lp-labs/crc32-codec

Streaming reflected IEEE CRC-32 and Castagnoli CRC-32C with snapshots, endian codecs and logarithmic checksum combination.

Original MIT TypeScript, **zero runtime or peer dependencies**. ESM/CommonJS and separate declarations. Node18+ and compatible ES2022 browsers with bigint. No network/filesystem/runtime services or import side effects. TypeScript/Prettier are development-only.

## Install

```sh
npm install @lp-labs/crc32-codec
```

## Working example

```js
import {
  crc32,
  createCrc32,
  crc32Bytes,
  readCrc32,
  combineCrc32,
  Crc32Error,
} from '@lp-labs/crc32-codec';
const encode = (text) => new TextEncoder().encode(text);
const full = crc32(encode('123456789'));
if (full !== 0xcbf43926) throw new Error('Bad IEEE CRC');
if (crc32(encode('123456789'), { polynomial: 'castagnoli' }) !== 0xe3069283)
  throw new Error('Bad CRC32C');
const partial = createCrc32().update(encode('1234'));
const resumed = createCrc32({}, partial.snapshot()).update(encode('56789'));
if (resumed.hex() !== 'cbf43926') throw new Error('Bad resume');
if (combineCrc32(partial.digest(), crc32(encode('56789')), 5) !== full)
  throw new Error('Bad combine');
if (readCrc32(crc32Bytes(full, 'little'), 'little') !== full) throw new Error('Bad codec');
partial.reset();
if (partial.digest() !== 0 || !(new Crc32Error('invalid', 'example') instanceof Error))
  throw new Error('Bad API');
```

CommonJS: `const api = require('@lp-labs/crc32-codec')`.

## Behavior, customization, errors and performance

Actual reflected IEEE CRC-32 (0xedb88320) and Castagnoli CRC-32C (0x82f63b78), initial and final XOR0xffffffff; known check values for ASCII123456789 are cbf43926/e3069283. Empty input checksum0. **CRC detects accidental corruption, NOT adversarial tampering, password security, authentication or signatures.** Use platform cryptographic hashes/MACs where needed.

crc32 accepts Uint8Array and options; createCrc32 returns update(bytes), digest() unsigned integer0..4294967295, lowercase8-digit hex(), snapshot() and reset(). update is synchronous, returns itself, and retains no input buffer. Snapshots contain polynomial, finalized value and cumulative bytes; resume via createCrc32(options,state), explicitly match the polynomial. Snapshots are untrusted metadata, not authenticated evidence; this API cannot verify a supplied snapshot's claimed earlier history. digest/hex do not finalize or prevent later updates. reset returns to empty count0. Empty updates allowed.

Options polynomial defaults ieee, maxBytes defaults1GiB, allowed nonnegative safe integer including0, enforced cumulatively before changing state. Snapshot exceeding byte budget throws limit; malformed/mismatched snapshots and options throw invalid. Successful updates retain no source references; state/results are detached plain values. Internal per-instance256-entry table costs1KiB; updates O(bytes), snapshots/reset O(1). Streaming callers control chunk sizes and worker integration.

crc32Bytes/readCrc32 convert exactly four bytes in big(default)/little endian. Readers honor byteOffset subarrays and never mutate input. combineCrc32(left,right,rightBytes,polynomial='ieee') computes CRC(A||B) from finalized CRC(A), CRC(B) and exact byte length of B, using GF(2) matrix exponentiation, O(log rightBytes *32 squared) bounded work/constant space. rightBytes must be nonnegative safe integer; zero right length requires checksum zero. Length counts bytes, not JS characters or bits. Both CRCs must use the SAME selected polynomial/initialization; no mixed-polynomial detection is possible from32-bit values. Combination does not read data and cannot validate the supplied lengths/checksums. Crc32Error codes invalid for type/value/format mismatches, limit for byte budget failures. Original independent implementation, no zlib or platform library import.

## Complete public API

Configure options and callbacks through these exported interfaces without changing internal source.

```ts
export type CrcPolynomial = 'ieee' | 'castagnoli';
export interface Crc32Options {
  polynomial?: CrcPolynomial;
  maxBytes?: number;
}
export interface Crc32State {
  polynomial: CrcPolynomial;
  value: number;
  bytes: number;
}
export interface Crc32Accumulator {
  update(bytes: Uint8Array): Crc32Accumulator;
  digest(): number;
  hex(): string;
  snapshot(): Crc32State;
  reset(): void;
}
export declare class Crc32Error extends Error {
  readonly code: 'invalid' | 'limit';
  constructor(code: 'invalid' | 'limit', message: string);
}
export declare function createCrc32(options?: Crc32Options, state?: Crc32State): Crc32Accumulator;
export declare function crc32(bytes: Uint8Array, options?: Crc32Options): number;
export declare function crc32Bytes(value: number, endian?: 'big' | 'little'): Uint8Array;
export declare function readCrc32(bytes: Uint8Array, endian?: 'big' | 'little'): number;
export declare function combineCrc32(
  left: number,
  right: number,
  rightBytes: number,
  kind?: CrcPolynomial,
): number;
```

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
