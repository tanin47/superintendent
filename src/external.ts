import crypto from 'crypto'
import Store from 'electron-store'

// These functions are here, so we can use them in test and prod.

export const cryptoApi = {
  verify (algorithm: string, input: string, publicKey: string, signature: string): boolean {
    return crypto.verify(
      algorithm,
      Buffer.from(input),
      crypto.createPublicKey(publicKey),
      Buffer.from(signature, 'base64')
    )
  },
  sign (algorithm: string, input: string, privateKey: string): string {
    const signature = crypto.sign(
      algorithm,
      Buffer.from(input),
      crypto.createPrivateKey(privateKey)
    )

    return signature.toString('base64')
  }
}

const store = new Store()

export const storeApi = {
  get: (key: string) => store.get(key),
  set: (key: string, value: string) => { store.set(key, value) },
  delete: (key: string) => { store.delete(key) }
}
