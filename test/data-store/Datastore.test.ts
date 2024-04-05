import { Datastore } from '../../src/data-store/Datastore'

describe('Datastore', () => {
  it('sanitizes name', async () => {
    await expect(Datastore.sanitizeName('test')).toEqual('test')
    await expect(Datastore.sanitizeName('test(1)')).toEqual('test_1')
    await expect(Datastore.sanitizeName('test(1)(2)something')).toEqual('test_1_2_something')
    await expect(Datastore.sanitizeName('')).toEqual('empty')
  })
})
