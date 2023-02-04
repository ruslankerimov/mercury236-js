export const CRC_LENGTH = 2;

export function crc(typedData) {
    let length = typedData.length;
    let crc = 0xFFFF;
    let odd;

    for (let i = 0; i < length; ++i) {
        crc = crc ^ typedData[i];

        for (let j = 0; j < 8; ++j) {
            odd = crc & 0x0001;
            crc = crc >> 1;

            if (odd) {
                crc = crc ^ 0xA001;
            }
        }
    }

    return new Uint8Array([
        crc & 0xFF,
        crc >> 8
    ]);
}

export function compareCRC(crc1, crc2) {
    return crc1[0] === crc2[0] && crc1[1] === crc2[1];
}
