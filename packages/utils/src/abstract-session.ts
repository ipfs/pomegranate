import { DEFAULT_SESSION_MIN_PROVIDERS, DEFAULT_SESSION_MAX_PROVIDERS } from '@helia/interface'
import { AbortError, TypedEventEmitter, setMaxListeners } from '@libp2p/interface'
import { Queue } from '@libp2p/utils/queue'
import { base64 } from 'multiformats/bases/base64'
import pDefer from 'p-defer'
import { BloomFilter } from './bloom-filter.js'
import type { BlockBroker, BlockRetrievalOptions, CreateSessionOptions } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { DeferredPromise } from 'p-defer'
import type { ProgressEvent } from 'progress-events'

export interface AbstractSessionComponents {
  logger: ComponentLogger
}

export interface AbstractCreateSessionOptions extends CreateSessionOptions {
  name: string
}

export interface BlockstoreSessionEvents<Provider> {
  provider: CustomEvent<Provider>
}

export abstract class AbstractSession<Provider, RetrieveBlockProgressEvents extends ProgressEvent> extends TypedEventEmitter<BlockstoreSessionEvents<Provider>> implements BlockBroker<RetrieveBlockProgressEvents> {
  private intialPeerSearchComplete?: Promise<void>
  private readonly requests: Map<string, Promise<Uint8Array>>
  private readonly name: string
  protected log: Logger
  protected logger: ComponentLogger
  protected readonly minProviders: number
  protected maxProviders: number
  public readonly providers: Provider[]
  private readonly evictionFilter: BloomFilter

  constructor (components: AbstractSessionComponents, init: AbstractCreateSessionOptions) {
    super()

    setMaxListeners(Infinity, this)
    this.name = init.name
    this.logger = components.logger
    this.log = components.logger.forComponent(this.name)
    this.requests = new Map()
    this.minProviders = init.minProviders ?? DEFAULT_SESSION_MIN_PROVIDERS
    this.maxProviders = init.maxProviders ?? DEFAULT_SESSION_MAX_PROVIDERS
    this.providers = []
    this.evictionFilter = BloomFilter.create(this.maxProviders)
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<RetrieveBlockProgressEvents> = {}): Promise<Uint8Array> {
    // see if we are already requesting this CID in this session
    const cidStr = base64.encode(cid.multihash.bytes)
    const existingJob = this.requests.get(cidStr)

    if (existingJob != null) {
      this.log('join existing request for %c', cid)
      return existingJob
    }

    const deferred: DeferredPromise<Uint8Array> = pDefer()
    this.requests.set(cidStr, deferred.promise)

    if (this.providers.length === 0) {
      let first = false

      if (this.intialPeerSearchComplete == null) {
        first = true
        this.log = this.logger.forComponent(`${this.name}:${cid}`)
        this.intialPeerSearchComplete = this.findNewProviders(cid, this.minProviders, options)
      }

      await this.intialPeerSearchComplete

      if (first) {
        this.log('found initial session peers for %c', cid)
      }
    }

    let foundBlock = false

    // this queue manages outgoing requests - as new peers are added to the
    // session they will be added to the queue so we can request the current
    // block from multiple peers as they are discovered
    const queue = new Queue<Uint8Array, { provider: Provider, priority?: number }>({
      concurrency: this.maxProviders
    })
    queue.addEventListener('error', (evt) => {
      if (options.signal?.aborted === true) {
        deferred.reject(new AbortError('Block want was aborted'))
      }
    })
    queue.addEventListener('failure', (evt) => {
      if (options.signal?.aborted === true) {
        deferred.reject(new AbortError('Block want was aborted'))
        return
      }

      this.log.error('error querying provider %o, evicting from session', evt.detail.job.options.provider, evt.detail.error)
      this.evict(evt.detail.job.options.provider)
    })
    queue.addEventListener('success', (evt) => {
      if (options.signal?.aborted === true) {
        deferred.reject(new AbortError('Block want was aborted'))
        return
      }

      // peer has sent block, return it to the caller
      foundBlock = true
      deferred.resolve(evt.detail.result)
    })
    queue.addEventListener('idle', () => {
      if (options.signal?.aborted === true) {
        deferred.reject(new AbortError('Block want was aborted'))
        return
      }

      // we found it, all good
      if (foundBlock) {
        return
      }

      // find more session peers and retry
      Promise.resolve()
        .then(async () => {
          try {
            this.log('no session peers had block for for %c, finding new providers', cid)

            // evict this.minProviders random providers to make room for more
            for (let i = 0; i < this.minProviders; i++) {
              if (this.providers.length === 0) {
                break
              }

              const provider = this.providers[Math.floor(Math.random() * this.providers.length)]
              this.evict(provider)
            }

            // find new providers for the CID
            await this.findNewProviders(cid, this.minProviders, options)

            // keep trying until the abort signal fires
            this.log('found new providers re-wanting %c', cid)
            this.requests.delete(cidStr)
            const block = await this.retrieve(cid, options)
            deferred.resolve(block)
          } catch (err: any) {
            this.log.error('could not find new providers for %c', cid, err)
            deferred.reject(err)
          }
        })
        .catch(err => {
          if (options.signal?.aborted === true) {
            return
          }

          this.log.error('error wanting session block for %c', cid, err)
        })
    })

    const peerAddedToSessionListener = (event: CustomEvent<Provider>): void => {
      queue.add(async () => {
        return this.queryProvider(cid, event.detail, options)
      }, {
        provider: event.detail
      })
        .catch(err => {
          if (options.signal?.aborted === true) {
            return
          }

          this.log.error('error wanting session block for %c', cid, err)
        })
    }

    // add new session peers to query as they are discovered
    this.addEventListener('provider', peerAddedToSessionListener)

    // query each session peer directly
    Promise.all([...this.providers].map(async (provider) => {
      return queue.add(async () => {
        return this.queryProvider(cid, provider, options)
      }, {
        provider
      })
    }))
      .catch(err => {
        if (options.signal?.aborted === true) {
          return
        }

        this.log.error('error wanting session block for %c', cid, err)
      })

    try {
      return await deferred.promise
    } finally {
      this.removeEventListener('provider', peerAddedToSessionListener)
      queue.clear()
      this.requests.delete(cidStr)
    }
  }

  evict (provider: Provider): void {
    this.evictionFilter.add(this.toEvictionKey(provider))
    const index = this.providers.findIndex(prov => this.equals(prov, provider))

    if (index === -1) {
      return
    }

    this.providers.splice(index, 1)
  }

  isEvicted (provider: Provider): boolean {
    return this.providers.some(prov => this.equals(prov, provider))
  }

  hasProvider (provider: Provider): boolean {
    // dedupe existing gateways
    if (this.providers.find(prov => this.equals(prov, provider)) != null) {
      return true
    }

    // dedupe failed session peers
    if (this.isEvicted(provider)) {
      return true
    }

    return false
  }

  /**
   * This method should search for providers and emit a `"provider"` event when
   * they are found.
   *
   * The returned promise should resolve when `count` providers have been found
   * but it should continue to search for providers until the session either has
   * `this.maxProviders` providers, or the passed abort signal fires an
   * `"abort"` event.
   */
  abstract findNewProviders (cid: CID, count: number, options: AbortOptions): Promise<void>

  /**
   * The subclass should contact the provider and request the block from it.
   *
   * If the provider cannot provide the block an error should be thrown.
   *
   * The provider will then be excluded from ongoing queries.
   */
  abstract queryProvider (cid: CID, provider: Provider, options: AbortOptions): Promise<Uint8Array>

  /**
   * Turn a provider into a concise Uint8Array representation for use in a Bloom
   * filter
   */
  abstract toEvictionKey (provider: Provider): Uint8Array | string

  /**
   * Return `true` if we consider one provider to be the same as another
   */
  abstract equals (providerA: Provider, providerB: Provider): boolean
}
