import Debug from 'debug';

import { crc, compareCRC, CRC_LENGTH } from './crc.js';
import { Mercury236Error } from './Mercury236Error.js';

const MIN_RESPONSE_PACKAGE_LENGTH = 2 + CRC_LENGTH;
const MAX_RESPONSE_PACKAGE_LENGTH = 256 + CRC_LENGTH;
const DEFAULT_READ_PASSWORD = '111111';

const debug = Debug('mercury236-js');

function convertFourBytes(bytes, offset = 0, factor = 1) {
    const value = (bytes[offset] << 16) |
        ((bytes[offset + 1] & 0x3F) << 24) |
        bytes[offset + 2] |
        (bytes[offset + 3] << 8);

    return value / factor;
}

function convertThreeBytes(bytes, offset = 0, factor = 1) {
    const value = ((bytes[offset] & 0x3F) << 16) |
        bytes[offset + 1] |
        (bytes[offset + 2] << 8);

    return value / factor;
}

function checkLength(bytes, length) {
    if (bytes.length !== length) {
        throw new Mercury236Error(Mercury236Error.WRONG_LENGTH);
    }
}

function checkMinLength(bytes, length) {
    if (bytes.length < length) {
        throw new Mercury236Error(Mercury236Error.WRONG_LENGTH);
    }
}

function checkMaxLength(bytes, length) {
    if (bytes.length > length) {
        throw new Mercury236Error(Mercury236Error.WRONG_LENGTH);
    }
}

class Mercury236 {

    constructor(options) {
        this._transport = options.transport;

        this.setAddress(options.address || 0);
    }

    setAddress(address) {
        if (typeof address !== 'undefined') {
            this._address = parseInt(address, 10) & 0xFE;
        }
    }

    async write(address, command, params, _isFromWrite) {
        const typedData = Uint8Array.from([
            address,
            command,
            ...(params || [])
        ]);

        const typedDataWithCRC = Uint8Array.from([
            ...typedData,
            ...crc(typedData)
        ]);

        debug(`[Mercury236OverTcp::write] sent data [ ${typedDataWithCRC} ]`);

        const responseTypedDataWithCRC = await this._transport.write(typedDataWithCRC);

        debug(`[Mercury236OverTcp::write] received data [ ${responseTypedDataWithCRC} ]`);

        checkMinLength(responseTypedDataWithCRC, MIN_RESPONSE_PACKAGE_LENGTH);
        checkMaxLength(responseTypedDataWithCRC, MAX_RESPONSE_PACKAGE_LENGTH);

        const responseAddress = responseTypedDataWithCRC[0];
        const responseTypedData = responseTypedDataWithCRC.slice(0, -CRC_LENGTH);
        const responseTypedDataWithoutAddress = responseTypedData.slice(1);
        const responseCRC = responseTypedDataWithCRC.slice(-CRC_LENGTH);

        if ( ! compareCRC(responseCRC, crc(responseTypedData))) {
            throw new Mercury236Error(Mercury236Error.WRONG_CRC);
        }

        if (responseAddress !== address) {
            throw new Mercury236Error(Mercury236Error.WRONG_ADDRESS);
        }

        if (responseTypedDataWithoutAddress.length === 1 && responseTypedDataWithoutAddress[0] === 5) {
            if ( ! _isFromWrite) {
                debug(`[Mercury236OverTcp::write] need to send init at first`);

                const status = await this.openChannel();

                if (status) {
                    return this.write(address, command, params, true);
                }
            }

            throw new Mercury236Error(Mercury236Error.INIT_PROBLEM);
        }

        return responseTypedDataWithoutAddress;
    }

    async openChannel(address) {
        this.setAddress(address);

        const response = await this.write(
            this._address,
            0x01,
            [ 0x01 ].concat(DEFAULT_READ_PASSWORD.split('').map(v => parseInt(v, 10)))
        );

        checkLength(response, 1);

        return response[0] === 0;
    }

    async closeChannel() {
        const response = await this.write(this._address, 0x02);

        checkLength(response, 1);

        return response[0] === 0;
    }

    async testChannel() {
        const response = await this.write(this._address, 0x00);

        checkLength(response, 1);

        return response[0] === 0;
    }

    async getTime() {
        const response = await this.write(this._address, 0x04, [
            0x00
        ]);

        checkLength(response, 8);

        const date = new Date();
        const parts = response.map(v => parseInt(v.toString(16), 10));

        date.setSeconds(parts[0]);
        date.setMinutes(parts[1]);
        date.setHours(parts[2]);
        date.setDate(parts[4]);
        date.setMonth(parts[5] - 1);
        date.setFullYear(2000 + parts[6]);

        return date;
    }

    async getEnergy(period = 0, month = 0, tariff = 0) {
        const response = await this.write(this._address, 0x05, [
            (period << 4) | (month & 0xF),
            tariff
        ]);

        checkLength(response, 16);

        const factor = 1000;

        return {
            active: convertFourBytes(response, 0, factor),
            reverseActive: convertFourBytes(response, 4, factor),
            reactive: convertFourBytes(response, 8, factor),
            reverseReactive: convertFourBytes(response, 12, factor)
        };
    }

    getMonthEnergy(month, tariff) {
        return this.getEnergy(3, month, tariff);
    }

    getCurrentMonthEnergy(tariff) {
        return this.getEnergy(3, (new Date).getMonth() + 1, tariff);
    }

    getLastMonthEnergy(tariff) {
        return this.getEnergy(3, (new Date).getMonth(), tariff);
    }

    getTodayEnergy(tariff) {
        return this.getEnergy(4, 0, tariff);
    }

    getYesterdayEnergy(tariff) {
        return this.getEnergy(5, 0, tariff);
    }

    getYearEnergy(tariff) {
        return this.getEnergy(1, 0, tariff);
    }

    getLastYearEnergy(tariff) {
        return this.getEnergy(2, 0, tariff);
    }

    async getVoltage() {
        const response = await this.write(this._address, 0x08, [
            0x16,
            0x11
        ]);

        checkLength(response, 9);

        const factor = 100;

        return {
            p1: convertThreeBytes(response, 0, factor),
            p2: convertThreeBytes(response, 3, factor),
            p3: convertThreeBytes(response, 6, factor),
        };
    }

    async getCurrent() {
        const response = await this.write(this._address, 0x08, [
            0x16,
            0x21
        ]);

        checkLength(response, 9);

        const factor = 100;

        return {
            p1: convertThreeBytes(response, 0, factor),
            p2: convertThreeBytes(response, 3, factor),
            p3: convertThreeBytes(response, 6, factor),
        };
    }

    async getCosF() {
        const response = await this.write(this._address, 0x08, [
            0x16,
            0x30
        ]);

        checkLength(response, 12);

        const factor = 1000;

        return {
            p1: convertThreeBytes(response, 3, factor),
            p2: convertThreeBytes(response, 6, factor),
            p3: convertThreeBytes(response, 9, factor),
            sum: convertThreeBytes(response, 0, factor),
        };
    }

    async getAngle() {
        const response = await this.write(this._address, 0x08, [
            0x16,
            0x51
        ]);

        checkLength(response, 9);

        const factor = 100;

        return {
            p1: convertThreeBytes(response, 0, factor),
            p2: convertThreeBytes(response, 3, factor),
            p3: convertThreeBytes(response, 6, factor),
        };
    }

    async getFrequency() {
        const response = await this.write(this._address, 0x08, [
            0x16,
            0x40
        ]);

        checkLength(response, 3);

        return {
            f: convertThreeBytes(response, 0, 100)
        };
    }

    async getPower() {
        const response = await this.write(this._address, 0x08, [
            0x16,
            0x00
        ]);

        checkLength(response, 12);

        const factor = 100;

        return {
            p1: convertThreeBytes(response, 3, factor),
            p2: convertThreeBytes(response, 6, factor),
            p3: convertThreeBytes(response, 9, factor),
            sum: convertThreeBytes(response, 0, factor),
        };
    }

    async getReactivePower() {
        const response = await this.write(this._address, 0x08, [
            0x16,
            0x08
        ]);

        checkLength(response, 12);

        const factor = 100;

        return {
            p1: convertThreeBytes(response, 3, factor),
            p2: convertThreeBytes(response, 6, factor),
            p3: convertThreeBytes(response, 9, factor),
            sum: convertThreeBytes(response, 0, factor),
        };
    }


    async getAll() {
        const response = await this.write(this._address, 0x08, [
            0x14,
            0xA0
        ]);

        return response;
    }
}

export { Mercury236 };
