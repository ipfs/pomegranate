import { expect } from 'aegir/chai'
import { stubInterface } from 'sinon-ts'
import { parseUrlString } from '../src/utils/parse-url-string.js'
import type { IPNS } from '@helia/ipns'

describe('parseUrlString', () => {
  describe('ipfs:// URLs', () => {
    it('can parse a URL with CID only', async () => {
      const ipns = stubInterface<IPNS>({})
      const result = await parseUrlString({
        urlString: 'ipfs://QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr',
        ipns
      })
      expect(result.protocol).to.equal('ipfs')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('')
    })
    it('can parse URL with CID+path', async () => {
      const ipns = stubInterface<IPNS>({})
      const result = await parseUrlString({
        urlString: 'ipfs://QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt',
        ipns
      })
      expect(result.protocol).to.equal('ipfs')
      expect(result.cid.toString()).to.equal('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm')
      expect(result.path).to.equal('1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt')
    })
  })
})