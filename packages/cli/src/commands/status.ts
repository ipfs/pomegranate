import type { Command } from './index.js'
import fs from 'node:fs'
import { logger } from '@libp2p/logger'
import type { RootArgs } from '../index.js'
import { findOnlineHelia } from '../utils/find-helia.js'

const log = logger('helia:cli:commands:status')

export const status: Command<RootArgs> = {
  command: 'status',
  description: 'Report the status of the Helia daemon',
  example: '$ helia status',
  offline: true,
  async execute ({ directory, rpcAddress, stdout }) {
    // socket file?
    const socketFilePath = rpcAddress

    if (fs.existsSync(socketFilePath)) {
      log(`Found socket file at ${socketFilePath}`)

      const {
        helia, libp2p
      } = await findOnlineHelia(directory, rpcAddress)

      if (libp2p != null) {
        await libp2p.stop()
      }

      if (helia == null) {
        log(`Removing stale socket file at ${socketFilePath}`)
        fs.rmSync(socketFilePath)
      } else {
        stdout.write('The daemon is running\n')
        return
      }
    } else {
      log(`Could not find socket file at ${socketFilePath}`)
    }

    stdout.write('The daemon is not running\n')
  }
}
