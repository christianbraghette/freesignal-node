const dbpath = "";

export class PizzinoNode {
    public readonly modules: { [key: string]: NodeModule } = {};

    constructor(opts: {
        modules?: Array<typeof NodeModule>;
    } = {}) {
        const { modules } = opts;
        if (modules) modules.forEach(module => this.modules[module.name] = new module(this));
    }
}

export class NodeModule {
    constructor(node: PizzinoNode) {

    }
}

export function createNode(modules: Array<typeof NodeModule>) {
    
}