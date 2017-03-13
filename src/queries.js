import * as I from 'immutable'

import * as F from './formula'

// Utilities

const escapeRegExp = (string) =>
  string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getFragment = (str='') => {
  const parts = str.split(/[~+&|\(\)]/)
  return parts[parts.length - 1].trim()
}

const replaceFragment = (q, expanded) => {
  if (!q) {
    return ''
  }

  const frag = getFragment(q)
  const rexp = new RegExp(escapeRegExp(frag) + '$')

  return q.replace(rexp, expanded)
}


// Generic finders

const all = (coll, key) => {
  key = key || 'name'
  return (state) => {
    const objs = state.get(coll) || I.List()
    return objs.sortBy(obj => obj.get(key)).valueSeq()
  }
}

const allSpaces = all('spaces')
const allProperties = all('properties')
const allTheorems = all('theorems')

const findSpace = (state, uid) => state.getIn(['spaces', uid])
const findProperty = (state, uid) => state.getIn(['properties', uid])
const findTheorem = (state, id) => (state.getIn(['theorems', id]))

const findTraitId = (state, id) => {
  const t = state.getIn(['traits', id])
  if (!t) {
    return
  }
  return t.merge({
    space: state.getIn(['spaces', t.get('space')]),
    property: state.getIn(['properties', t.get('property')])
  })
}

const findTraitSP = (state, spaceId, propertyId) => {
  const s = findSpace(state, spaceId)
  const p = findProperty(state, propertyId)

  const trait = state.getIn(['traitTable', s.get('uid')]).find(t => {
    return t.get('property') === p.get('uid')
  })

  return trait.merge({
    space: s,
    property: p
  })
}

const findTrait = (state, id, pid) => {
  if (id[0] === 'T') {
    return findTraitId(state, id)
  } else {
    return findTraitSP(state, id, pid)
  }
}

// Filtration

const filterByText = (state, {
  text,
  spaces
}) => {
  const finder = state.get('spaces.finder')
  spaces = spaces || state.get('spaces')

  if (!text) {
    return spaces
  }

  const matches = finder.search(text)
  return I.OrderedMap(matches.map(uid => [uid, spaces.get(uid)]))
}

const filterByFormula = (state, {
  formula,
  spaces
}) => {
  return spaces.filter(s => {
    const traits = state.getIn(['traitTable', s.get('uid')])
    if (!traits) {
      return false
    }

    return formula.evaluate(traits)
  })
}

const filter = (state, {
  text,
  formula,
  spaces
}) => {
  // TODO: validate params
  spaces = spaces || state.get('spaces')
  if (formula) {
    return filterByFormula(state, {
      formula,
      spaces
    })
  } else {
    return filterByText(state, {
      text,
      spaces
    })
  }
}

// Other exports

const parseFormula = (state, q) => {
  const parsed = F.parse(q)
  if (!parsed) {
    return
  }
  const finder = state.get('properties.finder')

  try {
    const formula = parsed.mapProperty(p => {
      const id = finder.getId(p)
      if (!id) {
        throw new Error("id not found")
      }
      return state.getIn(['properties', id])
    })
    return formula
  } catch (e) {
    // TODO: show error if properties not found
    return
  }
}

// TODO: do we still need this?
const searchByFormula = (state, formula, value = true) => {
  return state.get('traitTable').filter((traits) => {
    return formula.evaluate(traits) === value
  }).keySeq()
}

const suggestionsFor = (state, query, limit) => {
  if (!query) {
    return I.List([])
  }

  const finder = state.get('properties.finder')
  return finder.suggestionsFor(getFragment(query), limit)
}

const spaceTraits = (state, space) => {
  const traits = state.getIn(['traitTable', space.get('uid')])
  if (!traits) {
    return I.List([])
  }

  return traits.valueSeq().map(t => t.merge({
    space: state.getIn(['spaces', t.get('space')]),
    property: state.getIn(['properties', t.get('property')])
  })).sortBy((t, _id) => t.getIn(['property', 'name'])).toList()
}

const getProof = (state, trait) => {
  const proof = state.getIn(['proofs', trait.get('uid')])

  if (!proof) {
    return
  }
  return I.Map({
    theorems: proof.get('0').map((id) => findTheorem(state, id)),
    traits: proof.get('1').map((id) => findTrait(state, id))
  })
}

const hasProof = (state, trait) => {
  return state.hasIn(['proofs', trait.get('uid')])
}

const counterexamples = (state, theorem) => {
  const f = F.and(
    theorem.get('if').negate(),
    theorem.get('then')
  )

  return searchByFormula(state, f).map(id => state.getIn(['spaces', id]))
}

const theoremProperties = (t) => {
  return t.get('if').properties().union(
    t.get('then').properties()
  )
}

const relatedTheorems = (state, prop) => {
  return allTheorems(state).filter(t => {
    return theoremProperties(t).includes(prop)
  }).valueSeq().toList()
}

module.exports = {
  allSpaces,
  allProperties,
  allTheorems,
  findSpace,
  findProperty,
  findTrait,
  findTheorem,
  filterByText,
  filterByFormula,
  filter,
  counterexamples,
  hasProof,
  getProof,
  replaceFragment,
  relatedTheorems,
  theoremProperties,
  spaceTraits,
  suggestionsFor,
  parseFormula
}
