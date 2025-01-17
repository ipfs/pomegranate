/**
 * @packageDocumentation
 *
 * `@helia/json` makes working with JSON in {@link https://github.com/ipfs/helia Helia} simple & straightforward.
 *
 * See the {@link JSON} interface for all available operations.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { json } from '@helia/json'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 * const j = json(helia)
 *
 * const cid = await j.add({
 *   hello: 'world'
 * })
 * const obj = await j.get(cid)
 *
 * console.info(obj)
 * // { hello: 'world' }
 * ```
 */

import { CID } from 'multiformats/cid'
import * as jsonCodec from 'multiformats/codecs/json'
import { sha256 } from 'multiformats/hashes/sha2'
import type { GetBlockProgressEvents, PutBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockCodec } from 'multiformats/codecs/interface'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { ProgressOptions } from 'progress-events'

export interface JSONComponents {
  blockstore: Blockstore
}

export interface AddOptions extends AbortOptions, ProgressOptions<PutBlockProgressEvents> {
  hasher: MultihashHasher
}

export interface GetOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents> {
  codec: BlockCodec<any, unknown>
}

/**
 * The JSON interface provides a simple and intuitive way to add/get objects
 * with your Helia node and is a great place to start learning about IPFS.
 */
export interface JSON {
  /**
   * Add an object to your Helia node and get a CID that refers to the block the
   * object has been stored as.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { json } from '@helia/json'
   *
   * const helia = await createHelia()
   * const j = json(helia)
   *
   * const cid = await str.add({ hello: 'world' })
   *
   * console.info(cid)
   * // CID(bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea)
   * ```
   */
  add(str: unknown, options?: Partial<AddOptions>): Promise<CID>

  /**
   * Get an object from your Helia node, either previously added to it or to
   * another node on the network.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { json } from '@helia/json'
   * import { CID } from 'multiformats/cid'
   *
   * const helia = await createHelia()
   * const j = json(helia)
   *
   * const cid = CID.parse('bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea')
   * const obj = await j.get(cid)
   *
   * console.info(obj)
   * // { hello: 'world' }
   * ```
   */
  get<T>(cid: CID, options?: Partial<GetOptions>): Promise<T>
}

class DefaultJSON implements JSON {
  private readonly components: JSONComponents

  constructor (components: JSONComponents) {
    this.components = components
  }

  async add (obj: any, options: Partial<AddOptions> = {}): Promise<CID> {
    const buf = jsonCodec.encode(obj)
    const hash = await (options.hasher ?? sha256).digest(buf)
    const cid = CID.createV1(jsonCodec.code, hash)

    await this.components.blockstore.put(cid, buf, options)

    return cid
  }

  async get <T> (cid: CID, options: Partial<GetOptions> = {}): Promise<T> {
    if (cid.code !== jsonCodec.code) {
      throw new TypeError('The passed CID had an incorrect codec, it may correspond to a non-JSON block')
    }

    const buf = await this.components.blockstore.get(cid, options)

    return jsonCodec.decode(buf)
  }
}

/**
 * Create a {@link JSON} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function json (helia: { blockstore: Blockstore }): JSON {
  return new DefaultJSON(helia)
}
