import { createCrc32, type Crc32Accumulator } from '@lp-labs/crc32-codec';
const accumulator: Crc32Accumulator = createCrc32({ maxBytes: 0 });
const text: string = accumulator.hex();
void text;
// @ts-expect-error Only reflected supported polynomials
createCrc32({ polynomial: 'custom' });
