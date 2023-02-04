class Mercury236Error extends Error {
    constructor(...args) {
        super(...args);
    }
}

Mercury236Error.WRONG_LENGTH = 'wrong length';
Mercury236Error.WRONG_CRC = 'wrong crc';
Mercury236Error.WRONG_ADDRESS = 'wrong address';
Mercury236Error.INIT_PROBLEM = 'init problem';

export { Mercury236Error }