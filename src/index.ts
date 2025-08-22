import express, { Request, Response } from 'express';
import { encodeBase64, numberToUint8Array } from '@freesignal/utils';
import { KeyExchangeData, KeyExchangeDataBundle, LocalStorage } from '@freesignal/interfaces';
import { Datastore } from './datastore';
import { Datagram, Protocols } from '@freesignal/protocol';
import { FreeSignalAPI } from '@freesignal/protocol/api';
import QRCode from 'qrcode';


const FREESIGNAL_MIME = "application/x-freesignal";
const BODY_LIMIT = "10mb";

/*interface User {
    id: string;
    relay: string;
    name: string;
    authToken: string;
    publicKey: string;
}*/

type UserId = string;
type DatagramId = string;
type PublicKey = string;

class FreeSignalNode extends FreeSignalAPI {
    public readonly dbPath: string;
    protected readonly datagrams: LocalStorage<DatagramId, { datagram: Datagram, seen: boolean }>;
    protected readonly inbox: LocalStorage<UserId, DatagramId[]>;
    protected readonly outbox: LocalStorage<DatagramId, Datagram>;
    protected readonly keystore: LocalStorage<PublicKey, KeyExchangeDataBundle>;

    protected _postWorker?: NodeJS.Timeout;
    protected readonly app = express();;

    public constructor(secretSignKey: Uint8Array, secretBoxKey: Uint8Array, opts: {
        autostart?: boolean;
        dbpath?: string;
        port?: number;
        storage?: {};
    } = { autostart: true }) {
        let { port, dbpath, autostart } = opts;
        dbpath ??= './db';

        super({
            secretSignKey,
            secretBoxKey,
            sessions: new Datastore(`${dbpath}/sessions.db`),
            keyExchange: new Datastore(`${dbpath}/handshake.db`),
            users: new Datastore(`${dbpath}/users.db`)
        });

        this.dbPath = dbpath;
        this.datagrams = new Datastore(`${dbpath}/messages.db`)
        this.inbox = new Datastore(`${dbpath}/inbox.db`);
        this.outbox = new Datastore(`${dbpath}/outbox.db`);
        this.keystore = new Datastore(`${dbpath}/keystore.db`);

        this.app.use(express.raw({ type: FREESIGNAL_MIME, limit: BODY_LIMIT }));
        this.app.get('/datagrams', this.getDatagrams);
        this.app.post('/datagrams', this.postDatagrams);
        this.app.delete('/datagrams', this.deleteDatagrams);

        this.app.get('/handshake/:id?', this.getHandshake);
        this.app.post('/handshake', (req: Request, res: Response) => {
            res.status(200).json({ message: 'Welcome to the Pizzino Node API!' });
        });

        if (autostart) this.start(port ?? 3000);
    }

    protected readonly outboxWorker = async () => {
        if (!this._postWorker)
            this._postWorker = setTimeout(this.outboxWorker, 5000);
        const outbox = Array.from(await this.outbox.entries());
        if (outbox.length > 0) {
            outbox.map(val => val[1]).flat()
        }
        this._postWorker.refresh();
    }

    protected readonly getHandshake = async (req: Request, res: Response) => {
        try {
            if (req.params.id) {
                const bundle = await this.keystore.get(req.params.id);
                if (bundle && bundle.onetimePreKey.length > 0) {
                    const data: KeyExchangeData = {
                        version: bundle.version,
                        publicKey: bundle.publicKey,
                        identityKey: bundle.identityKey,
                        signedPreKey: bundle.signedPreKey,
                        signature: bundle.signature,
                        onetimePreKey: bundle.onetimePreKey.pop()!,
                    };
                    if (bundle.onetimePreKey.length === 0)
                        await this.keystore.delete(req.params.id);
                    else
                        await this.keystore.set(req.params.id, bundle);
                    return data;
                }
                return res.status(400).json({ error: 'Key bundle not found' });
            }
            return res.status(201).type(FREESIGNAL_MIME).send(this.keyExchange.generateData())
        } catch (error: any) {
            return res.status(500).json({ error: error.message })
        }
    }

    protected readonly getDatagrams = async (req: Request, res: Response) => {
        try {
            const { userId } = await this.digestToken(req.headers.authorization);
            const datagrams = (await Promise.all(
                (await this.inbox.get(userId) || []).map(messageId => this.datagrams.get(messageId))
            )).filter(message => !!message)
                .filter(message => !message.seen)
                .map(message => message.datagram);
            await Promise.all(datagrams.map(datagram => this.datagrams.set(datagram.id, { datagram, seen: true })));
            const data = await this.encryptData(this.packDatagrams(datagrams), userId);
            return res.status(200).type(FREESIGNAL_MIME).send(data.encode());
        } catch (error: any) {
            return res.status(401).json({ error: error.message });
        }
    }

    protected readonly postDatagrams = async (req: Request, res: Response) => {
        try {
            const { userId } = await this.digestToken(req.headers.authorization);
            if (!req.body) {
                return res.status(400).json({ error: 'Body is required' });
            }
            try {
                const datagrams = this.unpackDatagrams(await this.decryptData(req.body as Uint8Array, userId));
                try {
                    if (datagrams.length === 0) return 0;
                    const map = new Map<UserId, DatagramId[]>();
                    let count = 0;
                    for (const datagram of datagrams) {
                        if (datagram.protocol === Protocols.MESSAGE) {
                            await this.datagrams.set(datagram.id, { datagram: datagram, seen: false });
                            map.set(datagram.receiver, [...(map.get(datagram.receiver) || []), datagram.id]);
                            count++;
                        } else if (datagram.protocol === Protocols.RELAY) {
                            await this.outbox.set(datagram.id, datagram);
                            count++;
                        } else
                            return res.status(406).json({ error: "Bad protocol found in datagram", datagramId: datagram.id })
                    };
                    for (const [userId, messageIds] of map.entries()) {
                        const inbox = await this.inbox.get(userId) || [];
                        await this.inbox.set(userId, [...inbox, ...messageIds]);
                    }
                    return res.status(201).type(FREESIGNAL_MIME).send(await this.encryptData(numberToUint8Array(count), userId));
                } catch (error: any) {
                    return res.status(500).json({ error: error.message });
                }
            } catch (error: any) {
                return res.status(400).json({ error: error.message });
            }
        } catch (error: any) {
            return res.status(401).json({ error: error.message });
        }
    }

    protected readonly deleteDatagrams = async (req: Request, res: Response) => {
        try {
            const { userId } = await this.digestToken(req.headers.authorization);
            if (!req.body) {
                return res.status(400).json({ error: 'Body is required' });
            }
            try {
                const data = await this.decryptData(req.body as Uint8Array, userId);
                let count = 0;
                for (let i = 0; i < data.length; i += 16) {
                    await this.datagrams.delete(encodeBase64(data.subarray(i, i + 16)));
                    count++;
                }
                return res.status(201).type(FREESIGNAL_MIME).send(await this.encryptData(numberToUint8Array(count), userId));
            } catch (error: any) {
                return res.status(500).json({ error: error.message });
            }
        } catch (error: any) {
            return res.status(401).json({ error: error.message });
        }
    }

    /**
     * Avvia un server HTTP API sulla porta specificata (default 3000)
     */
    public start(port: number = 3000) {
        this.app.listen(port, () => {
            console.log(`API server listening on http://localhost:${port}`);
        });

        this.outboxWorker();
    }

    /*async handskake(): Promise<string> {
        const handshakeId = encodeBase64(crypto.randomBytes(16));
        const handshakeData = crypto.randomBytes(crypto.box.keyLength);
        this.handshakes.set(handshakeId, handshakeData);
        return await QRCode.toString(JSON.stringify({ id: handshakeId, data: handshakeData }), { type: 'terminal' });
    }*/

}

export function createNode(secretSignKey: Uint8Array, secretBoxKey: Uint8Array, opts: {
    autostart?: boolean;
    dbpath?: string;
    port?: number;
    storage?: {};
}): FreeSignalNode {
    return new FreeSignalNode(secretSignKey, secretBoxKey, opts);
}