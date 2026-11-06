import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crc32,
  createCrc32,
  crc32Bytes,
  readCrc32,
  combineCrc32,
  Crc32Error,
} from '../dist/esm/index.js';
const encode = (text) => new TextEncoder().encode(text);
test('published check vectors for IEEE and Castagnoli', () => {
  assert.equal(crc32(encode('123456789')), 0xcbf43926);
  assert.equal(crc32(encode('123456789'), { polynomial: 'castagnoli' }), 0xe3069283);
  assert.equal(crc32(new Uint8Array()), 0);
  assert.equal(createCrc32().hex(), '00000000');
});
test('all one-cut stream splits equal one-shot for both polynomials', () => {
  const bytes = Uint8Array.from({ length: 513 }, (_, i) => i % 256);
  for (const polynomial of ['ieee', 'castagnoli']) {
    const expected = crc32(bytes, { polynomial });
    for (let cut = 0; cut <= bytes.length; cut++)
      assert.equal(
        createCrc32({ polynomial })
          .update(bytes.subarray(0, cut))
          .update(bytes.subarray(cut))
          .digest(),
        expected,
      );
  }
});
test('reset and resume snapshots preserve count without buffer aliasing', () => {
  const accumulator = createCrc32().update(encode('1234')),
    saved = accumulator.snapshot();
  const resumed = createCrc32({}, saved).update(encode('56789'));
  saved.value = 0;
  assert.equal(resumed.hex(), 'cbf43926');
  accumulator.reset();
  assert.deepEqual(accumulator.snapshot(), { polynomial: 'ieee', value: 0, bytes: 0 });
});
test('combine matches independently concatenated bytes for both polynomials', () => {
  let state = 19;
  const random = (n) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 4294967296) * n);
  };
  for (const polynomial of ['ieee', 'castagnoli'])
    for (let sample = 0; sample < 200; sample++) {
      const a = Uint8Array.from({ length: random(256) }, () => random(256));
      const b = Uint8Array.from({ length: random(256) }, () => random(256));
      const merged = new Uint8Array(a.length + b.length);
      merged.set(a);
      merged.set(b, a.length);
      assert.equal(
        combineCrc32(crc32(a, { polynomial }), crc32(b, { polynomial }), b.length, polynomial),
        crc32(merged, { polynomial }),
      );
    }
});
test('checksum byte order conversion supports subarrays and owns bytes', () => {
  for (const endian of ['big', 'little']) {
    const bytes = crc32Bytes(0xcbf43926, endian);
    assert.equal(readCrc32(bytes, endian), 0xcbf43926);
    const padded = new Uint8Array(6);
    padded.set(bytes, 1);
    assert.equal(readCrc32(padded.subarray(1, 5), endian), 0xcbf43926);
  }
  assert.deepEqual([...crc32Bytes(0x12345678)], [0x12, 0x34, 0x56, 0x78]);
});
test('byte budget exact boundary rejects atomically and allows empty input', () => {
  const accumulator = createCrc32({ maxBytes: 3 }).update(encode('abc')),
    before = accumulator.snapshot();
  assert.throws(() => accumulator.update(Uint8Array.of(1)), { code: 'limit' });
  assert.deepEqual(accumulator.snapshot(), before);
  accumulator.update(new Uint8Array());
  assert.equal(createCrc32({ maxBytes: 0 }).digest(), 0);
});
test('guards reject invalid checksums endian snapshots and budgets', () => {
  for (const value of [-1, NaN, 1.1, 4294967296])
    assert.throws(() => crc32Bytes(value), Crc32Error);
  assert.throws(() => crc32Bytes(0, 'bad'), Crc32Error);
  assert.throws(() => readCrc32(new Uint8Array(3)), Crc32Error);
  assert.throws(() => crc32('not bytes'), Crc32Error);
  for (const options of [{ polynomial: 'bad' }, { maxBytes: -1 }, { maxBytes: Infinity }])
    assert.throws(() => createCrc32(options), Crc32Error);
  assert.throws(
    () => createCrc32({}, { polynomial: 'castagnoli', value: 0, bytes: 0 }),
    Crc32Error,
  );
  assert.throws(() => createCrc32({ maxBytes: 1 }, { polynomial: 'ieee', value: 0, bytes: 2 }), {
    code: 'limit',
  });
  assert.throws(() => combineCrc32(0, 1, 0), Crc32Error);
  assert.throws(() => combineCrc32(0, 0, -1), Crc32Error);
});
test('bytewise table agrees with independent reflected bitwise oracle', () => {
  for (const [polynomial, poly] of [
    ['ieee', 0xedb88320],
    ['castagnoli', 0x82f63b78],
  ]) {
    const bytes = Uint8Array.from({ length: 1024 }, (_, i) => (i * 97 + 13) & 255);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? poly : 0);
    }
    assert.equal(crc32(bytes, { polynomial }), (crc ^ 0xffffffff) >>> 0);
  }
});
