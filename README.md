<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/main.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/main.yml?query=branch%3Amain)

[Helia](https://github.com/ipfs/helia) is a lean, modular, and modern TypeScript implementation of IPFS for the prolific JS and browser environments.

See the [Manifesto](https://github.com/ipfs/helia/wiki/Manifesto), the [FAQ](https://github.com/ipfs/helia/wiki/FAQ), and the [State of IPFS in JS blog post from October 2022](https://blog.ipfs.tech/state-of-ipfs-in-js/) for more info.

# 🌟 Usage

A quick overview of how to get different types of data in and out of your Helia
node.

## 🪢 Strings

You can use the [@helia/strings](https://www.npmjs.com/package/@helia/strings)
module to easily add and get strings from your Helia node:

```js
import { createHelia } from 'helia'
import { strings } from '@helia/strings'

const helia = await createHelia()
const s = strings(helia)

const myImmutableAddress = await s.add('hello world')

console.log(await s.get(myImmutableAddress))
// hello world
```

## 🌃 JSON

The [@helia/json](https://www.npmjs.com/package/@helia/json) module lets you add
or get plain JS objects:

```js
import { createHelia } from 'helia'
import { json } from '@helia/json'

const helia = await createHelia()
const j = json(helia)

const myImmutableAddress = await j.add({ hello: 'world' })

console.log(await j.get(myImmutableAddress))
// { hello: 'world' }
```

## 🌠 DAG-JSON

The [@helia/dag-json](https://www.npmjs.com/package/@helia/dag-json) allows you
to store references to linked objects as
[CIDs](https://docs.ipfs.tech/concepts/content-addressing):

```js
import { createHelia } from 'helia'
import { dagJson } from '@helia/dag-json'

const helia = await createHelia()
const d = dagJson(helia)

const object1 = { hello: 'world' }
const myImmutableAddress1 = await d.add(object1)

const object2 = { link: myImmutableAddress1 }
const myImmutableAddress2 = await d.add(object2)

const retrievedObject = await d.get(myImmutableAddress2)
console.log(retrievedObject)
// { link: CID(baguqeerasor...) }

console.log(await d.get(retrievedObject.link))
// { hello: 'world' }
```

## 🌌 DAG-CBOR

[@helia/dag-cbor](https://www.npmjs.com/package/@helia/dag-cbor) works in a
similar way to `@helia/dag-json` but stores objects using
[Concise Binary Object Representation](https://cbor.io/):

```js
import { createHelia } from 'helia'
import { dagCbor } from '@helia/dag-cbor'

const helia = await createHelia()
const d = dagCbor(helia)

const object1 = { hello: 'world' }
const myImmutableAddress1 = await d.add(object1)

const object2 = { link: myImmutableAddress1 }
const myImmutableAddress2 = await d.add(object2)

const retrievedObject = await d.get(myImmutableAddress2)
console.log(retrievedObject)
// { link: CID(baguqeerasor...) }

console.log(await d.get(retrievedObject.link))
// { hello: 'world' }
```

## 🔒 Custom Hasher

A [hasher](https://github.com/multiformats/js-multiformats?tab=readme-ov-file#multihash-hashers) is used to determine the immutable address of the content (aka the [**CID**](https://github.com/multiformats/cid?tab=readme-ov-file#what-is-it)) being imported into helia. The default hasher used by the methods above is [sha2-256 multihash](https://github.com/multiformats/js-multiformats?tab=readme-ov-file#multihash-hashers-1), but others can be provided with [AddOptions](https://ipfs.github.io/helia/interfaces/_helia_dag_cbor.AddOptions.html). This is useful for applications that require hashers with specific properties; so in most cases keeping the default is recommended.

> **Changing the hasher will cause a different CID to be returned for the same content! In other words: the same content imported with different hashers is treated like unique content with a unique address.**

```js
import { createHelia } from 'helia'
import { dagCbor } from '@helia/dag-cbor'
import { sha512 } from 'multiformats/hashes/sha2'

const helia = await createHelia()
const d = dagCbor(helia)

const object1 = { hello: 'world' }

const cidWithSHA256 = await d.add(object1)
const cidWithSHA512 = await d.add(object1, {
  hasher: sha512
})

/** The same objects with different CIDs are treated as different objects */

console.log(cidWithSHA256)
// CID(bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae)
console.log(cidWithSHA512)
// CID(bafyrgqhai26anf3i7pips7q22coa4sz2fr4gk4q4sqdtymvvjyginfzaqewveaeqdh524nsktaq43j65v22xxrybrtertmcfxufdam3da3hbk)

const retrievedObject1 = await d.get(cidWithSHA256)
const retrievedObject2 = await d.get(cidWithSHA512)

console.log(retrievedObject1)
// { hello: 'world' }
console.log(retrievedObject2)
// { hello: 'world' }
```

# 🐾 Next steps

Check out the [helia-examples](https://github.com/ipfs-examples/helia-examples)
repo for how to do mostly anything with your Helia node.

# 🏃‍♀️ Getting Started

Check out the [Helia examples repo](https://github.com/ipfs-examples/helia-examples#examples), which covers a wide variety of use cases. If you feel something has been missed, follow the [contribution guide](https://github.com/ipfs-examples/helia-examples#contributing) and create a PR to the examples repo.

# 📗 Project Docs

- See the [project wiki](https://github.com/ipfs/helia/wiki).

# 📒 API Docs

- <https://ipfs.github.io/helia>

# 📐 System diagram

```mermaid
graph TD;
    User["User or application"]-->IPNS["@helia/ipns"];
    User-->UnixFS["@helia/unixfs"];
    User-->Libp2p;
    User-->Datastore;
    User-->Blockstore;
    UnixFS-->Blockstore;
    IPNS-->Datastore;
    subgraph helia [Helia]
      Datastore
      Blockstore-->BlockBrokers;
      BlockBrokers-->Bitswap;
      BlockBrokers-->TrustlessGateways;
      Libp2p-->DHT;
      Libp2p-->PubSub;
      Libp2p-->IPNI;
      Libp2p-->Reframe;
    end
    Blockstore-->BlockStorage["File system/IDB/S3/etc"];
    Datastore-->DataStorage["Level/S3/IDB/etc"];
    Bitswap-->Network;
    TrustlessGateways-->Gateway1;
    TrustlessGateways-->GatewayN;
    DHT-->Network;
    PubSub-->Network;
    IPNI-->Network;
    Reframe-->Network;
```

# 🏭 Code Structure

Helia embraces a modular approach and encourages users to bring their own implementations of various APIs to suit their needs.

The basic Helia API is defined in:

- [`/packages/interface`](./packages/interface) The Helia API

The API is implemented by:

- [`/packages/helia`](./packages/helia) An peer to peer implementation that uses [bitswap](https://docs.ipfs.tech/concepts/bitswap/), [libp2p](https://www.npmjs.com/package/libp2p) and [HTTP gateways](https://docs.ipfs.tech/reference/http/gateway/) as fallback
- [`/packages/http`](./packages/http) A lightweight implementation that uses [HTTP gateways](https://docs.ipfs.tech/reference/http/gateway/) exclusively

Helia also ships a number of supplemental libraries and tools that can be combined with Helia API implementations to accomplish tasks in distributed and trustless ways.

These libraries are not intended to be the "one true implementation" of any given API, but are made available for users to include depending on the need of their particular application:

- [./packages/car](./packages/car) The `@helia/car` module
- [./packages/dag-cbor](./packages/dag-cbor) The `@helia/dag-cbor` module
- [./packages/dag-json](./packages/dag-json) The `@helia/dag-json` module
- [./packages/ipns](./packages/ipns) The `@helia/ipns` module
- [./packages/json](./packages/json) The `@helia/json` module
- [./packages/mfs](./packages/mfs) The `@helia/mfs` module
- [./packages/strings](./packages/strings) The `@helia/strings` module
- [./packages/unixfs](./packages/unixfs) The `@helia/unixfs` module

An interop suite ensures everything is compatible:

- [`/packages/interop`](./packages/interop) Interop tests for Helia

## Other modules

There are several other modules available outside this repo:

- [`@helia/verified-fetch`](https://github.com/ipfs/helia-verified-fetch) A [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)-like API for retrieving trustless, verified content from the distributed web
- [`@helia/delegated-routing-v1-http-api`](https://github.com/ipfs/helia-delegated-routing-v1-http-api) An implementation of the [Delegated Routing v1 HTTP API](https://specs.ipfs.tech/routing/http-routing-v1/) including a server and a client
- [Helia WNFS](https://github.com/shovelers/helia-wnfs) a [WNFS](https://guide.fission.codes/developers/webnative/file-system-wnfs) implementation built on top of Helia
- [`@helia/remote-pinning`](https://github.com/ipfs/helia-remote-pinning) A Helia client for communicating with [IPFS Pinning Services](https://ipfs.github.io/pinning-services-api-spec/)
- [`@helia/http-gateway`](https://github.com/ipfs/helia-http-gateway) An implementation of the [IPFS HTTP Gateway API](https://docs.ipfs.tech/concepts/ipfs-gateway/#gateway-types) built with Helia

# 📣 Project status

Helia v1 shipped in 202303 (see [releases](https://github.com/ipfs/helia/releases)), and development keeps on trucking as we work on initiatives in the [roadmap](#roadmap) and make performance improvements and bug fixes along the way.

## Release Process

For information about our release process, please see our [release process wiki](https://github.com/ipfs/helia/wiki/Development-and-Release-Process#how-helia-is-released).

# 🛣️ Roadmap

Please find and comment on [the Roadmap here](https://github.com/ipfs/helia/issues/5).

# 👫 Get involved

- Watch our Helia Demo Day presentations [here](https://www.youtube.com/playlist?list=PLuhRWgmPaHtQAnt8INOe5-kV9TLVaUJ9v)
- We are sharing about the progress at periodic [Helia Demos](https://lu.ma/helia).  This is a good place to find out the latest and learn of ways to get involved.  We'd love to see you there!
- Pick up one of the [issues](https://github.com/ipfs/helia/issues).
- Come chat in Filecoin Slack #ip-js.  (Yes, we should bridge this to other chat environments.  Please comment [here](https://github.com/ipfs/helia/issues/33) if you'd like this.)

# 🤲 Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)

# 🛍️ Notable Consumers/Users

- See [Projects using Helia](https://github.com/ipfs/helia/wiki/Projects-using-Helia).

# 🌞 Branding

- See [Branding](https://github.com/ipfs/helia/wiki/Branding).

# 🪪 License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/ipfs/helia/blob/main/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/ipfs/helia/blob/main/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)
