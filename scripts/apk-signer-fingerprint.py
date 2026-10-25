#!/usr/bin/env python3
"""Read the first signer certificate from an APK v2/v3 signing block.

Run apksigner verify first; this helper compares certificate identity only.
"""
import hashlib
from pathlib import Path
import struct
import sys
import zipfile


def length_prefixed(data, offset=0):
    if offset + 4 > len(data):
        raise ValueError('Truncated APK signer data')
    size = struct.unpack_from('<I', data, offset)[0]
    end = offset + 4 + size
    if end > len(data):
        raise ValueError('Invalid APK signer data length')
    return data[offset + 4:end], end


def fingerprint(path):
    with zipfile.ZipFile(path) as archive:
        central = archive.start_dir
    with Path(path).open('rb') as stream:
        stream.seek(central - 24)
        footer = stream.read(24)
        if footer[8:] != b'APK Sig Block 42':
            raise ValueError('APK v2/v3 signing block not found')
        size = struct.unpack_from('<Q', footer)[0]
        if size < 24 or size + 8 > central:
            raise ValueError('Invalid APK signing block size')
        stream.seek(central - size)
        pairs = stream.read(size - 24)
    offset = 0
    while offset < len(pairs):
        if offset + 8 > len(pairs):
            raise ValueError('Truncated APK signing block')
        size = struct.unpack_from('<Q', pairs, offset)[0]
        offset += 8
        if size < 4 or offset + size > len(pairs):
            raise ValueError('Invalid APK signing entry')
        pair = pairs[offset:offset + size]
        offset += size
        if struct.unpack_from('<I', pair)[0] in (0x7109871a, 0xf05368c0):
            signers, _ = length_prefixed(pair[4:])
            signer, _ = length_prefixed(signers)
            signed, _ = length_prefixed(signer)
            _, position = length_prefixed(signed)
            certificates, _ = length_prefixed(signed, position)
            certificate, _ = length_prefixed(certificates)
            return hashlib.sha256(certificate).hexdigest()
    raise ValueError('No supported APK signing certificate found')


if __name__ == '__main__':
    print(fingerprint(sys.argv[1]))
