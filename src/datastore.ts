import { LocalStorage } from "@freesignal/interfaces";
import DB from '@seald-io/nedb';

export class Datastore<K, T> implements LocalStorage<K, T> {
    private readonly db: DB<[K, T] | T>;

    constructor(public readonly path: string, public readonly options: { keyFieldName?: string } = {}) {
        if (this.options.keyFieldName) {
            this.db = new DB<[K, T]>({ filename: this.path, autoload: true })
        } else {
            this.db = new DB<T>({ filename: this.path, autoload: true });
        }
    };

    async set(key: K, value: T): Promise<this> {
        return new Promise((resolve, reject) => {
            this.db.findOne({ [this.options.keyFieldName ?? 0]: key }, (err, doc) => {
                if (err) reject(err);
                if (doc) {
                    this.db.update({ [this.options.keyFieldName ?? 0]: key }, { $set: { 1: value } }, {}, (err, n) => { if (n > 0) resolve(this); else reject(err); });
                } else {
                    if (this.options.keyFieldName) {
                        this.db.insert(value, (err, newDoc) => { if (newDoc) resolve(this); else reject(err); });
                    } else {
                        this.db.insert([key, value], (err, newDoc) => { if (newDoc) resolve(this); else reject(err); });
                    }
                }
            })
        });
    }

    async get(key: K): Promise<T | undefined> {
        if (this.options.keyFieldName)
            return (await this.db.findOneAsync<T>({ [this.options.keyFieldName]: key }).execAsync()) ?? undefined;
        return (await this.db.findOneAsync<[K, T]>({ 0: key }).execAsync())[1] ?? undefined;
    }

    async has(key: K): Promise<boolean> {
        return !!(await this.db.findOneAsync({ [this.options.keyFieldName ?? 0]: key }).execAsync());
    }

    async delete(key: K): Promise<boolean> {
        return await this.db.removeAsync({ [this.options.keyFieldName ?? 0]: key }, {}) > 0;
    }

    async entries(): Promise<Iterable<[K, T]>> {
        if (this.options.keyFieldName) {
            return Array.from(this.db.getAllData<T>().values()).map(doc => [(doc as any)[this.options.keyFieldName!], doc] as [K, T]);
        } else {
            return this.db.getAllData<[K, T]>();//.map(doc => [doc[0], doc[1]]);
        }
    }

}