import { base32 } from 'multiformats/bases/base32'
import type { CID } from 'multiformats/cid'

interface TrustlessGatewayOpts {

  /**
   * Determins whether the gateway supports subdomain resolution
   */
  subdomainResolution: boolean
}

/**
 * A `TrustlessGateway` keeps track of the number of attempts, errors, and
 * successes for a given gateway url so that we can prioritize gateways that
 * have been more reliable in the past, and ensure that requests are distributed
 * across all gateways within a given `TrustlessGatewayBlockBroker` instance.
 */
export class TrustlessGateway {
  public readonly url: URL

  /**
   * Whether this gateway is a subdomain resolution style gateway
   */
  public subdomainResolution: boolean

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
   * The number of times this gateway has returned an invalid block. A gateway
   * that returns the wrong blocks for a CID should be considered for removal
   * from the list of gateways to fetch blocks from.
   */
  #invalidBlocks = 0

  /**
   * The number of times this gateway has successfully fetched a block.
   */
  #successes = 0

  constructor (url: URL | string, { subdomainResolution }: TrustlessGatewayOpts = { subdomainResolution: false }) {
    this.url = url instanceof URL ? url : new URL(url)
    this.subdomainResolution = subdomainResolution
  }

  /**
   * Fetch a raw block from `this.url` following the specification defined at
   * https://specs.ipfs.tech/http-gateways/trustless-gateway/
   */
  async getRawBlock (cid: CID, signal?: AbortSignal): Promise<Uint8Array> {
    const gwUrl = this.getGwUrl(cid)

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
   * Construct the Gateway URL for a CID
   */
  getGwUrl (cid: CID): URL {
    const gwUrl = new URL(this.url)

    if (this.subdomainResolution) {
      gwUrl.hostname = `${cid.toString(base32)}.ipfs.${gwUrl.hostname}`
    } else {
      gwUrl.pathname = `/ipfs/${cid.toString()}`
    }
    return gwUrl
  }

  /**
   * Encapsulate the logic for determining whether a gateway is considered
   * reliable, for prioritization. This is based on the number of successful attempts made
   * and the number of errors encountered.
   *
   * Unused gateways have 100% reliability; They will be prioritized over
   * gateways with a 100% success rate to ensure that we attempt all gateways.
   */
  reliability (): number {
    /**
     * if we have never tried to use this gateway, it is considered the most
     * reliable until we determine otherwise (prioritize unused gateways)
     */
    if (this.#attempts === 0) {
      return 1
    }

    if (this.#invalidBlocks > 0) {
      // this gateway may not be trustworthy..
      return -Infinity
    }

    /**
     * We have attempted the gateway, so we need to calculate the reliability
     * based on the number of attempts, errors, and successes. Gateways that
     * return a single error should drop their reliability score more than a
     * single success increases it.
     *
     * Play around with the below reliability function at https://www.desmos.com/calculator/d6hfhf5ukm
     */
    return this.#successes / (this.#attempts + this.#errors * 3)
  }

  /**
   * Increment the number of invalid blocks returned by this gateway.
   */
  incrementInvalidBlocks (): void {
    this.#invalidBlocks++
  }
}
