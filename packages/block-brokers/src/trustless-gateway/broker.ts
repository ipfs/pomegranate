import { TrustlessGateway } from './trustless-gateway.js'
import { DEFAULT_TRUSTLESS_GATEWAYS } from './index.js'
import type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayComponents, TrustlessGatewayGetBlockProgressEvents } from './index.js'
import type { BlockRetrievalOptions, BlockBroker } from '@helia/interface/blocks'
import type { Logger } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

/**
 * A class that accepts a list of trustless gateways that are queried
 * for blocks.
 */
export class TrustlessGatewayBlockBroker implements BlockBroker<TrustlessGatewayGetBlockProgressEvents> {
  private readonly gateways: TrustlessGateway[]
  private readonly log: Logger

  constructor (components: TrustlessGatewayComponents, init: TrustlessGatewayBlockBrokerInit = {}) {
    this.log = components.logger.forComponent('helia:trustless-gateway-block-broker')
    this.gateways = (init.gateways ?? DEFAULT_TRUSTLESS_GATEWAYS)
      .map((gw) => {
        if (typeof gw === 'string' || gw instanceof URL) {
          // backward compatibility defaults to path gateway
          return new TrustlessGateway(gw, { subdomainResolution: false })
        }

        return new TrustlessGateway(gw.url, { subdomainResolution: gw.subdomainResolution })
      })
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents> = {}): Promise<Uint8Array> {
    // Loop through the gateways until we get a block or run out of gateways
    // TODO: switch to toSorted when support is better
    const sortedGateways = this.gateways.sort((a, b) => b.reliability() - a.reliability())
    const aggregateErrors: Error[] = []

    for (const gateway of sortedGateways) {
      this.log('getting block for %c from %s', cid, gateway.url)
      try {
        const block = await gateway.getRawBlock(cid, options.signal)
        this.log.trace('got block for %c from %s', cid, gateway.url)
        try {
          await options.validateFn?.(block)
        } catch (err) {
          this.log.error('failed to validate block for %c from %s', cid, gateway.url, err)
          gateway.incrementInvalidBlocks()

          throw new Error(`unable to validate block for CID ${cid} from gateway ${gateway.url}`)
        }

        return block
      } catch (err: unknown) {
        this.log.error('failed to get block for %c from %s', cid, gateway.url, err)
        if (err instanceof Error) {
          aggregateErrors.push(err)
        } else {
          aggregateErrors.push(new Error(`unable to fetch raw block for CID ${cid} from gateway ${gateway.url}`))
        }
        // if signal was aborted, exit the loop
        if (options.signal?.aborted === true) {
          this.log.trace('request aborted while fetching raw block for CID %c from gateway %s', cid, gateway.url)
          break
        }
      }
    }

    throw new AggregateError(aggregateErrors, `unable to fetch raw block for CID ${cid} from any gateway`)
  }
}
