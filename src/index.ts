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
export class Crc32Error extends Error {
  constructor(
    readonly code: 'invalid' | 'limit',
    message: string,
  ) {
    super(message);
    this.name = 'Crc32Error';
  }
}
function uint32(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295)
    throw new Crc32Error('invalid', 'Expected unsigned 32-bit integer.');
}
function polynomial(value: CrcPolynomial): number {
  if (value === 'ieee') return 0xedb88320;
  if (value === 'castagnoli') return 0x82f63b78;
  throw new Crc32Error('invalid', 'Unsupported CRC polynomial.');
}
function table(poly: number): Uint32Array {
  const result = new Uint32Array(256);
  for (let byte = 0; byte < 256; byte++) {
    let crc = byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? poly : 0);
    result[byte] = crc >>> 0;
  }
  return result;
}
export function createCrc32(options: Crc32Options = {}, state?: Crc32State): Crc32Accumulator {
  const kind = options.polynomial ?? 'ieee',
    poly = polynomial(kind);
  const limit = options.maxBytes ?? 1073741824;
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > Number.MAX_SAFE_INTEGER)
    throw new Crc32Error('invalid', 'maxBytes must be a nonnegative safe integer.');
  let crc = 0xffffffff,
    count = 0;
  if (state !== undefined) {
    if (
      !state ||
      typeof state !== 'object' ||
      state.polynomial !== kind ||
      !Number.isSafeInteger(state.bytes) ||
      state.bytes < 0
    )
      throw new Crc32Error('invalid', 'Invalid/mismatched CRC snapshot.');
    uint32(state.value);
    if (state.bytes > limit) throw new Crc32Error('limit', 'Snapshot exceeds byte limit.');
    crc = (state.value ^ 0xffffffff) >>> 0;
    count = state.bytes;
  }
  const lookup = table(poly);
  const accumulator: Crc32Accumulator = {
    update(bytes: Uint8Array): Crc32Accumulator {
      if (!(bytes instanceof Uint8Array)) throw new Crc32Error('invalid', 'Expected Uint8Array.');
      if (bytes.length > limit - count) throw new Crc32Error('limit', 'CRC byte budget exceeded.');
      let next = crc;
      for (const byte of bytes) next = (next >>> 8) ^ lookup[(next ^ byte) & 255]!;
      crc = next >>> 0;
      count += bytes.length;
      return accumulator;
    },
    digest(): number {
      return (crc ^ 0xffffffff) >>> 0;
    },
    hex(): string {
      return accumulator.digest().toString(16).padStart(8, '0');
    },
    snapshot(): Crc32State {
      return { polynomial: kind, value: accumulator.digest(), bytes: count };
    },
    reset(): void {
      crc = 0xffffffff;
      count = 0;
    },
  };
  return accumulator;
}
export function crc32(bytes: Uint8Array, options: Crc32Options = {}): number {
  return createCrc32(options).update(bytes).digest();
}
export function crc32Bytes(value: number, endian: 'big' | 'little' = 'big'): Uint8Array {
  uint32(value);
  if (endian !== 'big' && endian !== 'little')
    throw new Crc32Error('invalid', 'Unsupported byte order.');
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, endian === 'little');
  return bytes;
}
export function readCrc32(bytes: Uint8Array, endian: 'big' | 'little' = 'big'): number {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 4)
    throw new Crc32Error('invalid', 'Expected four CRC bytes.');
  if (endian !== 'big' && endian !== 'little')
    throw new Crc32Error('invalid', 'Unsupported byte order.');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    0,
    endian === 'little',
  );
}
export function combineCrc32(
  left: number,
  right: number,
  rightBytes: number,
  kind: CrcPolynomial = 'ieee',
): number {
  uint32(left);
  uint32(right);
  const poly = polynomial(kind);
  if (!Number.isSafeInteger(rightBytes) || rightBytes < 0)
    throw new Crc32Error('invalid', 'rightBytes must be a nonnegative safe integer.');
  if (rightBytes === 0) {
    if (right !== 0)
      throw new Crc32Error('invalid', 'An empty right segment must have checksum zero.');
    return left;
  }
  const times = (matrix: Uint32Array, vector: number): number => {
    let result = 0,
      index = 0,
      remaining = vector >>> 0;
    while (remaining) {
      if (remaining & 1) result ^= matrix[index]!;
      remaining >>>= 1;
      index++;
    }
    return result >>> 0;
  };
  const square = (matrix: Uint32Array): Uint32Array => {
    const result = new Uint32Array(32);
    for (let index = 0; index < 32; index++) result[index] = times(matrix, matrix[index]!);
    return result;
  };
  // Reflected CRC linear operator for one zero bit, squared to one zero byte.
  let operator = new Uint32Array(32);
  operator[0] = poly;
  for (let index = 1; index < 32; index++) operator[index] = (2 ** (index - 1)) >>> 0;
  let byteOperator = square(square(square(operator))),
    length = rightBytes,
    result = left;
  while (length > 0) {
    if (length % 2 === 1) result = times(byteOperator, result);
    length = Math.floor(length / 2);
    if (length) byteOperator = square(byteOperator);
  }
  return (result ^ right) >>> 0;
}
