/**
 * @packageDocumentation
 *
 * `@helia/strings` makes working with strings {@link https://github.com/ipfs/helia Helia} simple & straightforward.
 *
 * See the [API docs](https://ipfs.github.io/helia/modules/_helia_strings.html) for all available operations.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { strings } from '@helia/strings'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 * const str = strings(helia)
 * const cid = await str.add('hello world')
 * const string = await str.get(cid)
 *
 * console.info(string)
 * // hello world
 * ```
 */

import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { GetBlockProgressEvents, PutBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockCodec } from 'multiformats/codecs/interface'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { ProgressOptions } from 'progress-events'

export interface StringsComponents {
  blockstore: Blockstore
}

export interface AddOptions extends AbortOptions, ProgressOptions<PutBlockProgressEvents> {
  hasher: MultihashHasher
}

export interface GetOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents> {
  codec: BlockCodec<any, unknown>
}

/**
 * The Strings interface provides a simple and intuitive way to add/get strings
 * with your Helia node and is a great place to start learning about IPFS.
 */
export interface Strings {
  /**
   * Add a string to your Helia node and get a CID that refers to the block the
   * string has been stored as.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { strings } from '@helia/strings'
   *
   * const helia = wait createHelia()
   * const str = strings(helia)
   * const cid = await str.add('hello world')
   *
   * console.info(cid)
   * // CID(bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e)
   * ```
   */
  add(str: string, options?: Partial<AddOptions>): Promise<CID>

  /**
   * Get a string from your Helia node, either previously added to it or to
   * another node on the network.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { strings } from '@helia/strings'
   * import { CID } from 'multiformats/cid'
   *
   * const helia = await createHelia()
   * const str = strings(helia)
   * const cid = CID.parse('bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e')
   * const string = await str.get(cid)
   *
   * console.info(string)
   * // hello world
   * ```
   */
  get(cid: CID, options?: Partial<GetOptions>): Promise<string>
}

class DefaultStrings implements Strings {
  private readonly components: StringsComponents

  constructor (components: StringsComponents) {
    this.components = components
  }

  async add (string: string, options: Partial<AddOptions> = {}): Promise<CID> {
    const buf = uint8ArrayFromString(string)
    const hash = await (options.hasher ?? sha256).digest(buf)
    const cid = CID.createV1(raw.code, hash)

    await this.components.blockstore.put(cid, buf, options)

    return cid
  }

  async get (cid: CID, options: Partial<GetOptions> = {}): Promise<string> {
    const buf = await this.components.blockstore.get(cid, options)

    return uint8ArrayToString(buf)
  }
}

/**
 * Create a {@link Strings} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function strings (helia: { blockstore: Blockstore }): Strings {
  return new DefaultStrings(helia)
}
