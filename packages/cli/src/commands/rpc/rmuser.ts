import type { Command } from '../index.js'
import { loadRpcKeychain } from './utils.js'

interface AddRpcUserArgs {
  positionals: string[]
}

export const rpcRmuser: Command<AddRpcUserArgs> = {
  command: 'rmuser',
  description: 'Remove a RPC user from your Helia node',
  example: '$ helia rpc rmuser <username>',
  async execute ({ directory, positionals, stdout }) {
    const user = positionals[0] ?? process.env.USER

    if (user == null) {
      throw new Error('No user specified')
    }

    const keychain = await loadRpcKeychain(directory)

    await keychain.removeKey(`rpc-user-${user}`)

    stdout.write(`Removed user ${user}\n`)
  }
}
