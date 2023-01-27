import { HasOptions, HasRequest, HasResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'

export function createHas (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = HasOptions.decode(options)
      const request = await stream.readPB(HasRequest)
      const cid = CID.decode(request.cid)

      const has = await config.helia.blockstore.has(cid, {
        signal,
        ...opts
      })

      stream.writePB({
        type: RPCCallResponseType.message,
        message: HasResponse.encode({
          has
        })
      },
      RPCCallResponse)
    }
  }
}
