import { FreeSignalNode } from "./api";

/**
 * Creates a new instance of {@link FreeSignalNode} with the provided secret keys and options.
 *
 * @param secretSignKey - A `Uint8Array` containing the secret signing key used for cryptographic operations.
 * @param secretBoxKey - A `Uint8Array` containing the secret box key used for encryption.
 * @param opts - Configuration options for the node.
 * @param opts.autostart - If `true`, the node will start automatically after creation. Optional.
 * @param opts.dbpath - The file system path to the database. Optional.
 * @param opts.port - The port number on which the node will listen. Optional.
 * @param opts.storage - Custom storage configuration object. Optional.
 * @returns A new {@link FreeSignalNode} instance.
 */
export function createNode(secretSignKey: Uint8Array, secretBoxKey: Uint8Array, opts: {
    autostart?: boolean;
    dbpath?: string;
    port?: number;
    storage?: {};
}): FreeSignalNode {
    return new FreeSignalNode(secretSignKey, secretBoxKey, opts);
}