import * as I from 'immutable'

import * as F from '../formula'
import { theoremProperties } from '../queries'
import Finder from '../finder'

let data
if (process.env.CI) {
  const request = require('sync-request')
  const result = request('GET', 'https://topology.jdabbs.com/db/test.json')
  data = JSON.parse(result.getBody())
} else {
  const fs = require('fs')
  data = JSON.parse(fs.readFileSync('./fixtures/test.json', 'utf8'))
}

const u = I.fromJS(data)

const index = (map, collectionK, idK) => {
  idK = idK || 'uid'
  return I.Map(map.get(collectionK).map(obj => [obj.get(idK), obj]))
}

const hydrate = (state) => {
  const h = (f) =>
    F.fromJSON(f.toJS()).mapProperty(p => state.getIn(['properties', p]))

  const theorems = state.get('theorems').map(t => {
    return t.merge({
      if: h(t.get('if')),
      then: h(t.get('then'))
    })
  })

  const propertyToTheorems = {}
  theorems.forEach(t => {
    theoremProperties(t).forEach(p => {
      const pid = p.get('uid')
      propertyToTheorems[pid] = propertyToTheorems[pid] || []
      propertyToTheorems[pid].push(t)
    })
  })

  return state.merge({
    theorems: theorems,
    propertyToTheorems: I.Map(propertyToTheorems)
  })
}

export const state = hydrate(I.Map({
  spaces: index(u, 'spaces'),
  'spaces.finder': new Finder(u.get('spaces')),
  properties: index(u, 'properties'),
  'properties.finder': new Finder(u.get('properties')),
  theorems: index(u, 'theorems'),
  // TODO: unify these two vvv
  traits: index(u, 'traits'),
  traitTable: u.get('traits').groupBy(t => t.get('space')).map(
    ts => I.Map(ts.map(t => [t.get('property'), t]))
  ),
  proofs: u.get('proofs')
}))
