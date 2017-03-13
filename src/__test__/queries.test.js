import * as I from 'immutable'

import * as Q from '../queries'
import * as F from '../formula'

import { state } from './helper'

describe('finders', () => {
  it('can pull collections', () => {
    expect(Q.allSpaces(state).size).toBeGreaterThan(159)
    expect(Q.allProperties(state).size).toBeGreaterThan(99)
    expect(Q.allTheorems(state).size).toBeGreaterThan(225)
  })

  it('can find spaces', () => {
    const s = Q.findSpace(state, 'S000001')
    expect(s.get('name')).toEqual('Finite Discrete Topology')
  })

  it('can find properties', () => {
    const p = Q.findProperty(state, 'P000016')
    expect(p.get('name')).toEqual('Compact')

    const rel = Q.relatedTheorems(state, p)
    expect(rel.size).toBeGreaterThan(15)
  })

  it('can find theorems', () => {
    const t = Q.findTheorem(state, 'I000059')
    const f = (name) => t.get(name).mapProperty(p => p.get('name'))

    expect(f('if')).toEqual(
      F.and(
        F.atom('Locally Compact', true),
        F.atom('$T_2$', true)
      )
    )
    expect(f('then')).toEqual(
      F.atom('Second Category', true)
    )

    expect(Q.counterexamples(state, t).map(s => s.get('name'))).toContain('Indiscrete Topology')
  })

  it('can find traits two ways', () => {
    const t = Q.findTrait(state, 'S000001', 'P000001')
    const u = Q.findTrait(state, 'T021796')
    expect(t).toEqual(u)
  })
})

describe('parsing', () => {
  it('can parse search formula', () => {
    const f = Q.parseFormula(state, 'compact + lind')

    expect(f.mapProperty(p => p.get('name'))).toEqual(
      F.and(
        F.atom('Compact', true),
        F.atom('Lindelof', true)
      )
    )
  })

  it('can fail to parse', () => {
    const f = Q.parseFormula(state, 'anouh2u98fhwuh10293hr09wrhgius')
    expect(f).toBeUndefined()
  })
})

it('can get suggestions for the search fragment', () => {
  const sugs = Q.suggestionsFor(state, 'normal + comple')

  expect(sugs.getIn(['0', 'name'])).toEqual('Completely Normal')
  expect(sugs.getIn(['1', 'name'])).toEqual('Completely Regular')
  expect(sugs.size).toBeGreaterThan(11)
})

it('can apply property name suggestions', () => {
  const q = 'normal + comple'
  const sugs = Q.suggestionsFor(state, q, 5)
  const selected = sugs.get('1')

  const result = Q.replaceFragment(q, selected.get('name'))

  expect(result).toEqual('normal + Completely Regular')
})

it('can filter space traits', () => {
  const ts = Q.spaceTraits(state, I.Map({
    uid: 'S000012'
  })).sortBy(t => t.getIn(['property', 'name'])).toJS()

  expect(ts[0].property.name).toEqual('$T_0$')
  expect(ts[0].value).toEqual(true)

  expect(ts.map(t => t.property.name)).toContain('Fréchet Urysohn')

  expect(ts.length).toBeGreaterThan(77)
})

describe('filtration', () => {
  // TODO: remove the valueSeq part, make sure these reverse
  it('can chain filters', () => {
    const planks = Q.filter(state, { text: 'Plank' })
    const compacta = Q.filter(state, { spaces: planks, formula: Q.parseFormula(state, 'compact') })

    const results = compacta.valueSeq().toList()

    expect(planks.size).toBeGreaterThan(4)
    expect(compacta.size).toEqual(1)
  })
})

describe('proof lookup', () => {
  it('can find proofs', () => {
    // The Long Line: t3
    const t = Q.findTrait(state, 'S000038', 'P000005')
    expect(Q.hasProof(state, t)).toEqual(true)

    const proof = Q.getProof(state, t)

    expect(
      proof.get('traits').map(t => t.getIn(['property', 'uid']))
    ).toEqual(I.List([
      'P000008' // t5
    ]))

    expect(proof.get('theorems').map(t => t.get('uid'))).toEqual(I.List([
      'I000115', // t3.5 => t3
      'I000034', // t1 & normal => t4
      'I000100', // t5 => t1 & completely normal
      'I000036'  // completely normal => normal
    ]))
  })

  it('can fail to find proofs', () => {
    const t = Q.findTrait(state, 'S000038', 'P000008')
    expect(Q.hasProof(state, t)).toEqual(false)
    expect(Q.getProof(state, t)).toBeUndefined()
  })
})

describe('null checks', () => {
  it('handles empty things', () => {
    const s = I.Map({uid: -1})
    expect(Q.parseFormula('+++')).toBeUndefined()
    expect(Q.replaceFragment('')).toEqual('')
    expect(Q.suggestionsFor(state, '')).toEqual(I.List([]))
    expect(Q.spaceTraits(state, s)).toEqual(I.List([]))
    expect(Q.findTrait(state, 'T999999')).toBeUndefined()

    expect(Q.filterByText(state, {})).toEqual(state.get('spaces'))
    expect(Q.filterByFormula(state, {spaces: [s]})).toEqual([])
  })
})
