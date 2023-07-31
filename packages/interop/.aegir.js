import getPort from 'aegir/get-port'
import { createServer } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    before: async (options) => {
      if (options.runner !== 'node') {
        const ipfsdPort = await getPort()
        const ipfsdServer = await createServer({
          host: '127.0.0.1',
          port: ipfsdPort
        }, {
          ipfsBin: process.env.KUBO_BINARY ? process.env.KUBO_BINARY : (await import('go-ipfs')).default.path(),
          kuboRpcModule: kuboRpcClient,
          ipfsOptions: {
            config: {
              Addresses: {
                Swarm: [
                  "/ip4/0.0.0.0/tcp/0",
                  "/ip4/0.0.0.0/tcp/0/ws",
                  "/ip4/0.0.0.0/udp/0/quic-v1/webtransport"
                ]
              }
            }
          }
        }).start()

        return {
          env: {
            IPFSD_SERVER: `http://127.0.0.1:${ipfsdPort}`
          },
          ipfsdServer
        }
      }

      return {}
    },
    after: async (options, beforeResult) => {
      if (options.runner !== 'node') {
        await beforeResult.ipfsdServer.stop()
      }
    }
  }
}
