import Datastore from '@seald-io/nedb';
import express, { Request, Response } from 'express'; // aggiungi questa riga

export class PizzinoNode {
    public readonly dbpath: string;
    public readonly modules: { [key: string]: NodeModule } = {};
    protected readonly db: { [Key in 'users' | 'chat']?: Datastore } = {};

    constructor(opts: {
        modules?: Array<typeof NodeModule>;
        dbpath?: string;
        port?: number;
    } = {}) {
        const { modules, port, dbpath } = opts;
        if (modules) modules.forEach(module => this.modules[module.name] = new module(this));
        this.dbpath = dbpath ?? './db';
        this.db.users = new Datastore({ filename: `${this.dbpath}/users.db`, autoload: true });
        this.db.chat = new Datastore({ filename: `${this.dbpath}/chat.db`, autoload: true });
        this.startApiServer(port ?? 3000);
    }

    /**
     * Avvia un server HTTP API sulla porta specificata (default 3000)
     */
    private startApiServer(port: number = 3000) {
        const app = express();
        app.use(express.json());

        /*
        // GET /users - restituisce tutti gli utenti
        app.get('/users', (req: Request, res: Response) => {
            this.db.users?.find({}, (err: Error, docs: Document) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(docs);
            });
        });

        // POST /users - aggiunge un nuovo utente
        app.post('/users', (req: Request, res: Response) => {
            this.db.users?.insert(req.body, (err, newDoc) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json(newDoc);
            });
        });

        // GET /chat - restituisce tutti i messaggi chat
        app.get('/chat', (req: Request, res: Response) => {
            this.db.chat?.find({}, (err: Error, docs: Document) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(docs);
            });
        });

        // POST /chat - aggiunge un nuovo messaggio chat
        app.post('/chat', (req: Request, res: Response) => {
            this.db.chat?.insert(req.body, (err, newDoc) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json(newDoc);
            });
        });*/

        app.get('/new', (req: Request, res: Response) => {
            res.send('Welcome to the Pizzino Node API!');
        });

        app.listen(port, () => {
            console.log(`API server listening on http://localhost:${port}`);
        });
    }
}

export class NodeModule {
    private readonly node: PizzinoNode;

    constructor(node: PizzinoNode) {
        this.node = node;
    }
}

export function createNode(opts: {
    modules?: Array<typeof NodeModule>;
    dbpath?: string;
} = {}): PizzinoNode {
    return new PizzinoNode(opts);
}