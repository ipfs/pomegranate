/**
 * @packageDocumentation
 *
 * The API defined by a Helia node
 *
 * @example
 *
 * ```typescript
 * import type { Helia } from '@helia/interface'
 *
 * export function doSomething(helia: Helia) {
 *   // use helia node functions here
 * }
 * ```
 */

import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from '@libp2p/interfaces'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { Datastore } from 'interface-datastore'

/**
 * The API presented by a Helia node.
 */
export interface Helia {
  /**
   * Returns information about this node
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   *
   * const node = await createHelia()
   * const id = await node.id()
   * console.info(id)
   * // { peerId: PeerId(12D3Foo), ... }
   * ```
   */
  id: (options?: IdOptions) => Promise<IdResponse>

  /**
   * The underlying libp2p node
   */
  libp2p: Libp2p

  /**
   * Where the blocks are stored
   */
  blockstore: Blockstore

  /**
   * A key/value store
   */
  datastore: Datastore
}

export interface CatOptions extends AbortOptions {
  offset?: number
  length?: number
}

export interface IdOptions extends AbortOptions {
  peerId?: PeerId
}

export interface IdResponse {
  peerId: PeerId
  multiaddrs: Multiaddr[]
  agentVersion: string
  protocolVersion: string
  protocols: string[]
}
