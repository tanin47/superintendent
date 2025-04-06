import { Datastore } from '../../src/data-store/Datastore'

describe('Datastore', () => {
  it('sanitizes name', () => {
    expect(Datastore.sanitizeName('test')).toEqual('test')
    expect(Datastore.sanitizeName('test(1)')).toEqual('test_1')
    expect(Datastore.sanitizeName('test(1)(2)something')).toEqual('test_1_2_something')
    expect(Datastore.sanitizeName('')).toEqual('empty')
  })
})
