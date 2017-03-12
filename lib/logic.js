const I = require('immutable')
// import * as D from './display'

const F = require('./formula')
const Q = require('./queries')

const GIVEN = 'GIVEN'
const TAUTOLOGY = 'TAUTOLOGY'

const buildContradiction = (theorem, evidence) => {
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
  return theorems.valueSeq().toList().push(theorem)
}

const disprove = (state, formula, onError) => {
  // console.log(D.formula(state, formula))

  let traits = I.Map()
  let evidence = {}
  let contradiction = null

  let theoremsByProp = {}
  Q.allTheorems(state).forEach(t => {
    Q.theoremProperties(t).forEach(p => {
      const pid = p.get('uid')
      theoremsByProp[pid] = theoremsByProp[pid] || []
      theoremsByProp[pid].push(t)
    })
  })

  let checkQ = []
  const force = (f, theorem, properties) => {
    if (f.and) {
      f.and.forEach(sf => force(sf, theorem, properties))
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
          contradiction = buildContradiction(theorem, result.falses)
          throw new Error('Contradiction')
        } else if (result.unknown) {
          force(result.unknown, theorem, result.falses.reduce((acc, props) => acc.concat(props)))
        }
      }
    } else {
      const prop = f.property.get('uid')
      const trait = traits.get(prop)
      if (trait) {
        if (trait.get('value') !== f.value) {
          contradiction = TAUTOLOGY
          throw new Error('in force', theorem)
        }
      } else {
        traits = traits.set(prop, I.Map({
          value: f.value
        }))
        evidence[prop] = {
          theorem: theorem,
          properties: properties
        }
        checkQ = checkQ.concat(theoremsByProp[prop] || [])
      }
    }
  }

  const apply = (theorem) => {
    const a = theorem.get('if')
    const c = theorem.get('then')
    const av = a.evaluate(traits)
    const cv = c.evaluate(traits)

    if (av === true && cv === false) {
      contradiction = buildContradiction(theorem, evidence)
      throw new Error('in apply', theorem)
    } else if (av === true) {
      force(c, theorem, a.properties())
    } else if (cv === false) {
      force(a.negate(), theorem, c.properties())
    }
  }

  try {
    force(formula, GIVEN, I.List())

    while (checkQ.length > 0) {
      const theorem = checkQ.shift()
      const before = traits
      // console.log(D.theorem(state, theorem))
      apply(theorem)
      if (traits !== before) {
        // console.log(D.traits(state, traits))

        // If our initial formula to force is (a | b) => c
        //   and we have just proved ~b, we need to re-force
        // TODO: diff traits and only run this when the formula applies
        force(formula, theorem, I.List())
      }
    }
  } catch (e) {
    if (!contradiction && onError) {
      onError(e)
      return
    }
    return contradiction
  }
}

const proveConverse = (state, theorem, onError) => {
  return disprove(state, F.and(
    theorem.get('if').negate(),
    theorem.get('then')
  ), onError)
}

module.exports = {
  TAUTOLOGY: TAUTOLOGY,
  disprove: disprove,
  proveConverse: proveConverse
}
