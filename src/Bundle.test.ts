import { Bundle, deserialize, serialize } from './Bundle'

import { property, space, trait } from './testUtils'

describe('Bundle', () => {
  describe('serialization', () => {
    function roundtrip(name: string, bundle: Bundle) {
      it(`roundtrips ${name}`, () => {
        expect(
          deserialize(JSON.parse(JSON.stringify(serialize(bundle)))),
        ).toEqual(bundle)
      })
    }

    roundtrip('full', {
      properties: new Map([
        ['P1', property({ uid: 'P1' })],
        ['P2', property({ uid: 'P2' })],
        ['P3', property({ uid: 'P3' })],
      ]),
      spaces: new Map([
        [
          'S1',
          space({
            uid: 'S1',
            refs: [
              { name: 'doi', doi: 'doi' },
              { name: 'wikipedia', wikipedia: 'wikipedia' },
              { name: 'mr', mr: 'mr' },
              { name: 'mathse', mathse: 'mathse' },
              { name: 'mo', mo: 'mo' },
            ],
          }),
        ],
      ]),
      traits: new Map([['S1|P1', trait({ space: 'S1', property: 'P1' })]]),
      theorems: new Map(),
      version: { ref: 'test', sha: 'HEAD' },
    })
  })
})
