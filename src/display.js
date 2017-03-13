import * as F from './formula'

const theorem = (state, theorem) => {
  const a = F.toString(theorem.get('if'))
  const c = F.toString(theorem.get('then'))
  return `${a} => ${c}`
}

const traits = (state, ts) => {
  return ts.entrySeq().map(([k,v],i) => (
    `${state.getIn(['properties', k, 'name'])}=${v.get('value')}`
  )).toJS()
}

const formula = (state, formula) => {
  return F.toString(formula)
}

module.exports = {
  theorem: theorem,
  traits: traits,
  formula: formula
}
