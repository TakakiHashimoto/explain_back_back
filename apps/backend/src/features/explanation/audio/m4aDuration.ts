/**
 * Reads the duration of an m4a (MP4) file from its `moov/mvhd` box.
 * The client-reported duration is not trusted, because the transcription cost depends on the real length.
 * @param buf - The whole audio file.
 * @returns The duration in seconds, or null when the buffer is not a readable MP4 file.
 */
export function readM4aDurationSec(buf: Buffer): number | null {
  const moov = findBox(buf, 0, buf.length, "moov");
  if (!moov) return null;

  const mvhd = findBox(buf, moov.start, moov.end, "mvhd");
  if (!mvhd) return null;

  const version = buf.readUInt8(mvhd.start);
  // version 0: 32-bit times; version 1: 64-bit times (after 4 bytes of version + flags)
  if (version === 0) {
    if (mvhd.start + 20 > mvhd.end) return null;
    const timescale = buf.readUInt32BE(mvhd.start + 12);
    const duration = buf.readUInt32BE(mvhd.start + 16);
    return timescale > 0 ? duration / timescale : null;
  }
  if (version === 1) {
    if (mvhd.start + 32 > mvhd.end) return null;
    const timescale = buf.readUInt32BE(mvhd.start + 20);
    const duration = Number(buf.readBigUInt64BE(mvhd.start + 24));
    return timescale > 0 ? duration / timescale : null;
  }
  return null;
}

/**
 * Finds the first box of the given type between `from` and `to`.
 * @returns The byte range of the box payload (after the header), or null when not found.
 */
function findBox(
  buf: Buffer,
  from: number,
  to: number,
  type: string,
): { start: number; end: number } | null {
  let offset = from;

  while (offset + 8 <= to) {
    let size = buf.readUInt32BE(offset);
    const boxType = buf.toString("latin1", offset + 4, offset + 8);
    let headerSize = 8;

    if (size === 1) {
      // 64-bit size follows the type
      if (offset + 16 > to) return null;
      size = Number(buf.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      // box extends to the end of its parent
      size = to - offset;
    }

    if (size < headerSize || offset + size > to) return null;

    if (boxType === type) {
      return { start: offset + headerSize, end: offset + size };
    }
    offset += size;
  }

  return null;
}
