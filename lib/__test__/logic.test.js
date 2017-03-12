import * as I from 'immutable'

import * as Q from '../queries'
import * as L from '../logic'

import { state } from './helper'

const p = (str) => Q.parseFormula(state, str)

it('can disprove with direct implications', () => {
  const f = p('t_1 + ~t_0')
  const result = L.disprove(state, f)

  expect(result.map(t => t.get('uid'))).toEqual(
    I.List(['I000119'])
  )
})

it('can disprove with chained implications', () => {
  const f = p('t_2 + ~t_0')
  const result = L.disprove(state, f)

  expect(result.map(t => t.get('uid'))).toEqual(
    I.List(['I000173', 'I000174'])
  )
})

it('can disprove with compound implications', () => {
  const f = p('metrizable + ~countably metacompact')
  const result = L.disprove(state, f)

  expect(result.map(t => t.get('uid'))).toEqual(
    I.List(['I000171', 'I000016', 'I000056', 'I000014'])
  )
})

it('can disprove one that it had trouble with', () => {
  const f = p('t_3 + ~t_2')
  const result = L.disprove(state, f)

  expect(result.map(t => t.get('uid'))).toEqual(
    I.List(['I000236', 'I000032'])
  )
})

it('handles reversing conjunctions', () => {
  const f = p('second countable + ~separable')
  const result = L.disprove(state, f)

  expect(result.map(t => t.get('uid'))).toEqual(
    I.List(['I000125'])
  )
})

it('handles tautologies', () => {
  const f = p('compact + ~compact')
  const result = L.disprove(state, f)

  expect(result).toEqual(L.TAUTOLOGY)
})

it('can prove converses', () => {
  const thrm = I.Map({
    if: p('t_1 + regular'),
    then: p('t_3')
  })
  const result = L.proveConverse(state, thrm)

  expect(result.map(i => i.get('uid'))).toEqual(I.List([
    "I000236", // t3 => t1
    "I000146"  // t3 => regular
  ]))
})
