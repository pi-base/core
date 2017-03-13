import * as I from 'immutable'
import * as D from './display'

import * as F from './formula'
import * as Q from './queries'

const GIVEN = 'GIVEN'
const TAUTOLOGY = 'TAUTOLOGY'

const trace = (x) => {
  // console.log(x)
  return x
}

const contradiction = (theorem, evidence) => {
  let theorems = I.Map() // prop => theorem
  let properties = Q.theoremProperties(theorem).toJS()

  while (properties.length > 0) {
    const pid = properties.shift().uid
    if (!theorems.get(pid)) {
      const ev = evidence[pid]
      if (ev) { // TODO: understand when this happens
        if (ev.theorem !== GIVEN) {
          theorems = theorems.set(pid, ev.theorem)
        }
        properties = properties.concat(ev.properties.toJS())
      }
    }
  }
  const err = new Error('Contradiction')
  err.contradiction = theorems.valueSeq().toList().push(theorem)
  throw err
}

const forceAtom = (f, theorem, props, { propsToThrms, traits, evidence, queue }) => {
  const pid = f.property.get('uid')
  const trait = traits.get(pid)
  if (trait) {
    if (trait.get('value') !== f.value) {
      const err = new Error('Contradiction')
      err.contradiction = TAUTOLOGY
      throw err
    }
  } else {
    evidence[pid] = {
      theorem: theorem,
      properties: props
    }
    return {
      traits: traits.set(pid, I.Map({
        value: f.value
      })),
      evidence: evidence,
      queue: queue.concat(propsToThrms.get(pid) || [])
    }
  }

  return { traits, evidence, queue }
}

const force = (propsToThrms, formula, assumedTheorem, assumedProperties, status) => {
  let queue = []
  let traits = status.traits
  let evidence = status.evidence

  const rec = (f, thrm, props) => {
    if (f.and) {
      f.and.forEach(sf => rec(sf, thrm, props))
    } else if (f.or) {
      const result = f.or.reduce((support, sf) => {
        if (!support) {
          return null
        }

        const value = sf.evaluate(traits)
        if (value === true) {
          return null // Can't force anything
        } else if (value === false) {
          support.falses.push(sf.properties())
        } else if (support.unknown) {
          return null // Can't determine which to force
        } else {
          support.unknown = sf
        }
        return support
      }, {
        falses: [],
        unknown: null
      })

      if (result) {
        if (result.falses.length === f.or.length) {
          contradiction(thrm, result.falses)
        } else if (result.unknown) {
          rec(result.unknown, assumedTheorem, result.falses.reduce((acc, props) => acc.concat(props)))
        }
      }
    } else {
      const r = forceAtom(f, thrm, props, { propsToThrms, traits, evidence, queue })
      queue = r.queue
      traits = r.traits
      evidence = r.evidence
    }
  }

  rec(formula, assumedTheorem, assumedProperties)

  return {
    queue: queue,
    traits: traits,
    evidence: evidence
  }
}

const applyTheorem = (propsToThrm, theorem, status) => {
  const a = theorem.get('if')
  const c = theorem.get('then')
  const av = a.evaluate(status.traits)
  const cv = c.evaluate(status.traits)

  if (av === true && cv === false) {
    contradiction(theorem, status.evidence)
  } else if (av === true) {
    return force(propsToThrm, c, theorem, a.properties(), status)
  } else if (cv === false) {
    return force(propsToThrm, a.negate(), theorem, c.properties(), status)
  }

  return {
    queue: [],
    traits: status.traits,
    evidence: status.evidence
  }
}

const combine = (a,b) => {
  return {
    traits: b.traits,
    evidence: b.evidence,
    queue: a.queue.concat(b.queue || [])
  }
}

const tryDisprove = (state, formula) => {
  const propsToThrms = state.get('propertyToTheorems')

  let status = force(propsToThrms, formula, GIVEN, I.List(), {
    traits: I.Map(),
    evidence: {},
    queue: []
  })

  while (status.queue.length > 0) {
    const theorem = status.queue.shift()
    const before = status.traits
    trace(D.theorem(state, theorem))
    let result = applyTheorem(propsToThrms, theorem, status)
    status = combine(status, result)

    if (status.traits !== before) {
      trace(D.traits(state, status.traits))

      // If our initial formula to force is (a | b) => c
      //   and we have just proved ~b, we need to re-force
      // TODO: diff traits and only run this when the formula applies
      result = force(propsToThrms, formula, theorem, I.List(), status)
      status = combine(status, result)
    }
  }
}

const disprove = (state, formula) => {
  trace(D.formula(state, formula))
  try {
    tryDisprove(state, formula)
    return
  } catch (e) {
    if (e.message !== 'Contradiction') { throw e }
    return e.contradiction
  }
}

const proveConverse = (state, theorem) => {
  return disprove(state, F.and(
    theorem.get('if').negate(),
    theorem.get('then')
  ))
}

module.exports = {
  TAUTOLOGY: TAUTOLOGY,
  disprove: disprove,
  proveConverse: proveConverse
}
