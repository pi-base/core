import * as F from './formula'

export const theorem = (state, theorem) => {
  const a = F.toString(theorem.get('if'))
  const c = F.toString(theorem.get('then'))
  return `${a} => ${c}`
}

export const traits = (state, ts) => {
  return ts.entrySeq().map(([k,v],i) => (
    `${state.getIn(['properties', k, 'name'])}=${v.get('value')}`
  )).toJS()
}

export const formula = (state, formula) => {
  return F.toString(formula)
}
