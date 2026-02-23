/**
 * Minimal protobuf decoder — handles wire type 0 (varint) and wire type 2 (length-delimited).
 *
 * Used to decode poe.ninja builds search API responses (protobuf, not JSON).
 * No third-party protobuf library needed.
 */

export interface ProtoField {
  fieldNumber: number;
  wireType: number;
  value: number | Uint8Array;
}

/**
 * Decode a varint from the buffer at the given offset.
 * Returns [value, newOffset].
 */
function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) break; // safety: don't exceed safe JS integer range
  }
  return [result >>> 0, pos];
}

/**
 * Decode all top-level fields from a protobuf-encoded buffer.
 */
export function decodeFields(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let pos = 0;

  while (pos < buf.length) {
    const [tag, newPos] = readVarint(buf, pos);
    pos = newPos;

    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // Varint
      const [value, nextPos] = readVarint(buf, pos);
      pos = nextPos;
      fields.push({ fieldNumber, wireType, value });
    } else if (wireType === 2) {
      // Length-delimited
      const [length, dataPos] = readVarint(buf, pos);
      const data = buf.slice(dataPos, dataPos + length);
      pos = dataPos + length;
      fields.push({ fieldNumber, wireType, value: data });
    } else {
      // Unsupported wire type — bail
      break;
    }
  }

  return fields;
}

/**
 * Interpret a length-delimited field as a UTF-8 string.
 * Falls back to manual decode for Hermes (no TextDecoder).
 */
export function fieldAsString(field: ProtoField): string {
  if (typeof field.value === "number") return String(field.value);
  const bytes = field.value;

  // Try TextDecoder first (available on most JS engines)
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  // Manual UTF-8 decode for Hermes
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      result += String.fromCharCode(b);
      i++;
    } else if (b < 0xe0) {
      result += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      result += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      );
      i += 3;
    } else {
      // 4-byte UTF-8 → surrogate pair
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      result += String.fromCharCode(
        0xd800 + ((cp - 0x10000) >> 10),
        0xdc00 + ((cp - 0x10000) & 0x3ff)
      );
      i += 4;
    }
  }
  return result;
}

/**
 * Interpret a length-delimited field as a nested message and decode its fields.
 */
export function fieldAsMessage(field: ProtoField): ProtoField[] {
  if (typeof field.value === "number") return [];
  return decodeFields(field.value);
}
