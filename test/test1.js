import { Mercury236, Mercury236TcpTransport } from '../src/index.js';

const mercury236 = new Mercury236({
    address: 154,
    transport: new Mercury236TcpTransport({
        host: '192.168.1.200',
        port: '4196'
    })
});

try {
    // console.log(await mercury236.openChannel(154));
    // console.log(await mercury236.testChannel());
    // console.log(await mercury236.getTime());
    // console.log(await mercury236.getLastMonthEnergy());
    // console.log(await mercury236.getVoltage());
    // console.log(await mercury236.getCurrent());
    // console.log(await mercury236.getCosF());
    // console.log(await mercury236.getAngle());
    // console.log(await mercury236.getPower());
    // console.log(await mercury236.getReactivePower());
    console.log(await mercury236.getAll());
    // console.log(await mercury236.closeChannel());
} catch(e) {
    console.log(e);
}