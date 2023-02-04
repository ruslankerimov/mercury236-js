import { once } from 'node:events';
import net from 'node:net';
import Debug from 'debug';

import { Mercury236Error } from './Mercury236Error.js';

const debug = Debug('mercury236-js');

class Mercury236TcpTransport {

    constructor(connectOptions) {
        this._connectOptions = connectOptions;

        this.socket = new net.Socket();

        [ 'connect', 'close', 'error', 'timeout', 'end', 'drain', 'data' ].forEach(event => {
            this.socket.on(event, () => {
                debug(`[Mercury236TcpTransport] event '${event}' was fired'`);
            });
        });

        this.socket.on('timeout', () => {
            this.socket.end();
        });

        this.socket.setTimeout(1000);

        this.open();
    }

    async open() {
        const socket = this.socket;

        if (socket.pending) {
            if ( ! socket.connecting) {
                socket.connect(this._connectOptions);
            }

            try {
                await once(socket, 'connect');
            } catch (e) {
                throw new Mercury236Error('connect error', { cause: e }); // TODO
            }
        }
    }

    async close() {
        const socket = this.socket;

        if ( ! socket.pending || socket.connecting) {
            socket.end();

            try {
                await once(socket, 'close');
            } catch (e) {
                throw new Mercury236Error(e);
            }
        }
    }

    async write(data) {
        await this.open();

        this.socket.write(Uint8Array.from(data));

        const [ response ] = await once(this.socket, 'data');

        return new Uint8Array(response.buffer);
    }

}

export { Mercury236TcpTransport };