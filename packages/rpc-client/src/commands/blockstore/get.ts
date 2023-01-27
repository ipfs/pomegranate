import { RPCCallRequest, RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { GetOptions, GetRequest, GetResponse } from '@helia/rpc-protocol/blockstore'
import { HELIA_RPC_PROTOCOL, RPCError } from '@helia/rpc-protocol'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { pbStream } from 'it-pb-stream'
import type { CID } from 'multiformats/cid'

export function createBlockstoreGet (config: HeliaRpcMethodConfig): Helia['blockstore']['get'] {
  const get: Helia['blockstore']['get'] = async (cid: CID, options = {}) => {
    const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

    const stream = pbStream(duplex)
    stream.writePB({
      resource: '/blockstore/get',
      method: 'INVOKE',
      authorization: config.authorization,
      options: GetOptions.encode({
        ...options
      })
    }, RPCCallRequest)
    stream.writePB({
      cid: cid.bytes
    }, GetRequest)
    const response = await stream.readPB(RPCCallResponse)

    duplex.close()

    if (response.type === RPCCallResponseType.message) {
      if (response.message == null) {
        throw new TypeError('RPC response had message type but no message')
      }

      const message = GetResponse.decode(response.message)

      return message.block
    }

    throw new RPCError(response)
  }

  return get
}
