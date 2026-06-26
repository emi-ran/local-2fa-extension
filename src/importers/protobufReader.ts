export interface RawOtpParameters {
  secret?: Uint8Array;
  name?: string;
  issuer?: string;
  algorithm?: number;
  digits?: number;
  type?: number;
  counter?: number;
}

export interface RawMigrationPayload {
  otpParameters: RawOtpParameters[];
  version?: number;
  batchSize?: number;
  batchIndex?: number;
  batchId?: number;
}

/**
 * Decodes a varint from a Uint8Array starting at offset.
 * Updates offset object.
 */
export function readVarint(buffer: Uint8Array, offset: { val: number }): number {
  let result = 0;
  let shift = 0;
  
  while (offset.val < buffer.length) {
    const byte = buffer[offset.val++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return result;
    }
    shift += 7;
    if (shift > 64) {
      throw new Error("Varint too long (overflow)");
    }
  }
  throw new Error("Truncated varint");
}

/**
 * Reads a length-delimited field and returns a subarray.
 * Updates offset object.
 */
export function readLengthDelimited(
  buffer: Uint8Array,
  offset: { val: number }
): Uint8Array {
  const len = readVarint(buffer, offset);
  if (offset.val + len > buffer.length) {
    throw new Error("Truncated length-delimited data");
  }
  const sub = buffer.subarray(offset.val, offset.val + len);
  offset.val += len;
  return sub;
}

/**
 * Parses OtpParameters nested message.
 */
export function parseOtpParameters(buffer: Uint8Array): RawOtpParameters {
  const offset = { val: 0 };
  const res: RawOtpParameters = {};
  const decoder = new TextDecoder();

  while (offset.val < buffer.length) {
    const tag = readVarint(buffer, offset);
    const wireType = tag & 0x07;
    const fieldNum = tag >> 3;

    if (wireType === 2) {
      // Length-delimited: secret (bytes), name (string), issuer (string)
      const bytes = readLengthDelimited(buffer, offset);
      if (fieldNum === 1) {
        res.secret = bytes;
      } else if (fieldNum === 2) {
        res.name = decoder.decode(bytes);
      } else if (fieldNum === 3) {
        res.issuer = decoder.decode(bytes);
      }
    } else if (wireType === 0) {
      // Varint: algorithm, digits, type, counter
      const val = readVarint(buffer, offset);
      if (fieldNum === 4) {
        res.algorithm = val;
      } else if (fieldNum === 5) {
        res.digits = val;
      } else if (fieldNum === 6) {
        res.type = val;
      } else if (fieldNum === 7) {
        res.counter = val;
      }
    } else if (wireType === 1) {
      // 64-bit field, skip 8 bytes
      if (offset.val + 8 > buffer.length) throw new Error("Truncated 64-bit field");
      offset.val += 8;
    } else if (wireType === 5) {
      // 32-bit field, skip 4 bytes
      if (offset.val + 4 > buffer.length) throw new Error("Truncated 32-bit field");
      offset.val += 4;
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }

  return res;
}

/**
 * Parses a top-level MigrationPayload message.
 */
export function parseMigrationPayload(buffer: Uint8Array): RawMigrationPayload {
  const offset = { val: 0 };
  const res: RawMigrationPayload = { otpParameters: [] };

  while (offset.val < buffer.length) {
    const tag = readVarint(buffer, offset);
    const wireType = tag & 0x07;
    const fieldNum = tag >> 3;

    if (wireType === 2) {
      const bytes = readLengthDelimited(buffer, offset);
      if (fieldNum === 1) {
        res.otpParameters.push(parseOtpParameters(bytes));
      }
    } else if (wireType === 0) {
      const val = readVarint(buffer, offset);
      if (fieldNum === 2) {
        res.version = val;
      } else if (fieldNum === 3) {
        res.batchSize = val;
      } else if (fieldNum === 4) {
        res.batchIndex = val;
      } else if (fieldNum === 5) {
        res.batchId = val;
      }
    } else if (wireType === 1) {
      if (offset.val + 8 > buffer.length) throw new Error("Truncated 64-bit field");
      offset.val += 8;
    } else if (wireType === 5) {
      if (offset.val + 4 > buffer.length) throw new Error("Truncated 32-bit field");
      offset.val += 4;
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }

  return res;
}
