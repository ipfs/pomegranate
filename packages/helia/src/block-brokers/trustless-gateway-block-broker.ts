import { logger } from '@libp2p/logger'
import type { BlockRetriever } from '@helia/interface/blocks'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

const log = logger('helia:trustless-gateway-block-broker')

/**
 * A `TrustlessGateway` keeps track of the number of attempts, errors, and
 * successes for a given gateway url so that we can prioritize gateways that
 * have been more reliable in the past, and ensure that requests are distributed
 * across all gateways within a given `TrustedGatewayBlockBroker` instance.
 */
class TrustlessGateway {
  public readonly url: URL
  /**
   * The number of times this gateway has been attempted to be used to fetch a
   * block. This includes successful, errored, and aborted attempts. By counting
   * even aborted attempts, slow gateways that are out-raced by others will be
   * considered less reliable.
   */
  #attempts = 0

  /**
   * The number of times this gateway has errored while attempting to fetch a
   * block. This includes `response.ok === false` and any other errors that
   * throw while attempting to fetch a block. This does not include aborted
   * attempts.
   */
  #errors = 0

  /**
   * The number of times this gateway has successfully fetched a block.
   */
  #successes = 0

  constructor (url: URL | string) {
    this.url = url instanceof URL ? url : new URL(url)
  }

  /**
   * Fetch a raw block from `this.url` following the specification defined at
   * https://specs.ipfs.tech/http-gateways/trustless-gateway/
   */
  async getRawBlock (cid: CID, signal?: AbortSignal): Promise<Uint8Array> {
    const gwUrl = this.url
    gwUrl.pathname = `/ipfs/${cid.toString()}`

    // necessary as not every gateway supports dag-cbor, but every should support
    // sending raw block as-is
    gwUrl.search = '?format=raw'

    if (signal?.aborted === true) {
      throw new Error(`Signal to fetch raw block for CID ${cid} from gateway ${this.url} was aborted prior to fetch`)
    }

    try {
      this.#attempts++
      const res = await fetch(gwUrl.toString(), {
        signal,
        headers: {
        // also set header, just in case ?format= is filtered out by some
        // reverse proxy
          Accept: 'application/vnd.ipld.raw'
        },
        cache: 'force-cache'
      })
      if (!res.ok) {
        this.#errors++
        throw new Error(`unable to fetch raw block for CID ${cid} from gateway ${this.url}`)
      }
      this.#successes++
      return new Uint8Array(await res.arrayBuffer())
    } catch (cause) {
      // @ts-expect-error - TS thinks signal?.aborted can only be false now
      // because it was checked for true above.
      if (signal?.aborted === true) {
        throw new Error(`fetching raw block for CID ${cid} from gateway ${this.url} was aborted`)
      }
      this.#errors++
      throw new Error(`unable to fetch raw block for CID ${cid}`)
    }
  }

  /**
   * Encapsulate the logic for determining whether a gateway is considered
   * reliable, for prioritization. This is based on the number of successful attempts made
   * and the number of errors encountered.
   *
   * Unused gateways have 100% reliability; They will be prioritized over
   * gateways with a 100% success rate to ensure that we attempt all gateways.
   */
  get reliability (): number {
    /**
     * if we have never tried to use this gateway, it is considered the most
     * reliable until we determine otherwise (prioritize unused gateways)
     */
    if (this.#attempts === 0) {
      return 1
    }

    /**
     * We have attempted the gateway, so we need to calculate the reliability
     * based on the number of attempts, errors, and successes. Gateways that
     * return a single error should drop their reliability score more than a
     * single success increases it.
     *
     * Play around with the below reliability function at https://www.desmos.com/calculator/d6hfhf5ukm
     */
    return this.#successes / (this.#attempts + (this.#errors * 3))
  }
}

export type TrustlessGatewayGetBlockProgressEvents =
  ProgressEvent<'trustless-gateway:get-block:fetch', URL>

/**
 * A class that accepts a list of trustless gateways that are queried
 * for blocks.
 */
export class TrustedGatewayBlockBroker implements BlockRetriever<
ProgressOptions<TrustlessGatewayGetBlockProgressEvents>
> {
  private readonly gateways: TrustlessGateway[]

  constructor (urls: Array<string | URL>) {
    this.gateways = urls.map((url) => new TrustlessGateway(url))
  }

  async retrieve (cid: CID, options: AbortOptions & ProgressOptions<TrustlessGatewayGetBlockProgressEvents> = {}): Promise<Uint8Array> {
    // Loop through the gateways until we get a block or run out of gateways
    const sortedGateways = this.gateways.sort((a, b) => b.reliability - a.reliability)
    const aggregateErrors: Error[] = []
    for (const gateway of sortedGateways) {
      log('getting block for %c from %s', cid, gateway.url)
      try {
        const block = await gateway.getRawBlock(cid, options.signal)
        log.trace('got block for %c from %s', cid, gateway.url)

        return block
      } catch (err: unknown) {
        log.error('failed to get block for %c from %s', cid, gateway.url, err)
        if (err instanceof Error) {
          aggregateErrors.push(err)
        } else {
          aggregateErrors.push(new Error(`unable to fetch raw block for CID ${cid} from gateway ${gateway.url}`))
        }
        // if signal was aborted, exit the loop
        if (options.signal?.aborted === true) {
          log.trace('request aborted while fetching raw block for CID %c from gateway %s', cid, gateway.url)
          break
        }
      }
    }

    throw new AggregateError(aggregateErrors, `unable to fetch raw block for CID ${cid} from any gateway`)
  }
}
