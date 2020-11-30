import {
  And,
  Atom,
  Formula,
  Or,
  evaluate,
  negate,
  properties,
} from '../Formula'
import ImplicationIndex from './ImplicationIndex'
import Queue from './Queue'
import { Id, Implication } from './Types'
import { Derivations, Proof } from './Derivations'

// TODO: is it deduction, or derivation

export type Contradiction<TheoremId = Id, PropertyId = Id> = Proof<
  TheoremId,
  PropertyId
>
export type Derivation<TheoremId = Id, PropertyId = Id> = {
  property: PropertyId
  value: boolean
  proof: Proof<TheoremId, PropertyId>
}
type Result<TheoremId = Id, PropertyId = Id> =
  | {
    kind: 'contradiction'
    contradiction: Contradiction<TheoremId, PropertyId>
  }
  | { kind: 'derivations'; derivations: Derivations<TheoremId, PropertyId> }

// Given a collection of implications and a collection of traits for an object,
// find either the collection of derivable traits, or a contradiction
export function deduceTraits<TheoremId = Id, PropertyId = Id>(
  implications: ImplicationIndex<TheoremId, PropertyId>,
  traits: Map<PropertyId, boolean>
): Result<TheoremId, PropertyId> {
  return new Prover(implications, traits).run()
}

// Given a collection of implications and a candidate formula,
// return a proof of why the formula is unsatisfiable, if possible
//
// The current proof strategy is to force the formula and then look for a
// a contradiction. Note that this does not find all possible proofs - e.g. when
// the formula is a disjunction, `force(a | b)` does not actually force anything.
export function disproveFormula<TheoremId = Id, PropertyId = Id>(
  implications: ImplicationIndex<TheoremId, PropertyId>,
  formula: Formula<PropertyId>
): TheoremId[] | 'tautology' | undefined {
  const prover = new Prover<TheoremId | 'given', PropertyId>(implications)

  const contradiction = prover.force('given', formula)
  if (contradiction) {
    return formatProof(contradiction)
  }

  const result = prover.run()
  if (result.kind === 'contradiction') {
    return formatProof(result.contradiction)
  }
}

// Given a collection of implications and a candidate implication,
// attempt to derive a proof of the candidate
export function proveTheorem<TheoremId = Id, PropertyId = Id>(
  theorems: ImplicationIndex<TheoremId, PropertyId>,
  when: Formula<PropertyId>,
  then: Formula<PropertyId>
): TheoremId[] | 'tautology' | undefined {
  // We don't want to `disproveFormula(when + ~then)` given the current
  // limitations of `disproveFormula` above. Instead we:
  //
  // * force `then`
  // * run deductions
  // * force `~when`
  // * run deductions
  //
  // Note that this still has edges, e.g.
  // * `A | B => C` doesn't circle back to assert `then`
  // * `A | B => C + D` can't get started at all
  let contradiction: Contradiction<TheoremId | 'given', PropertyId> | undefined
  let result: Result<TheoremId | 'given', PropertyId>

  const prover = new Prover<TheoremId | 'given', PropertyId>(theorems)
  contradiction = prover.force('given', when)
  if (contradiction) {
    return formatProof(contradiction)
  }

  result = prover.run()
  if (result.kind === 'contradiction') {
    return formatProof(result.contradiction)
  }

  contradiction = prover.force('given', negate(then))
  if (contradiction) {
    return formatProof(contradiction)
  }

  result = prover.run()
  if (result.kind === 'contradiction') {
    return formatProof(result.contradiction)
  }
}

class Prover<
  TheoremId = Id,
  PropertyId = Id,
  Theorem extends Implication<TheoremId, PropertyId> = Implication<
    TheoremId,
    PropertyId
  >
  > {
  private traits: Map<PropertyId, boolean>
  private derivations: Derivations<TheoremId, PropertyId>

  private queue: Queue<TheoremId, PropertyId, Theorem>

  constructor(
    implications: ImplicationIndex<TheoremId, PropertyId, Theorem>,
    traits: Map<PropertyId, boolean> = new Map()
  ) {
    this.traits = traits
    this.derivations = new Derivations([...traits.keys()])
    this.queue = new Queue(implications)

    traits.forEach((_: boolean, id: PropertyId) => {
      this.queue.mark(id)
    })
  }

  run(): Result<TheoremId, PropertyId> {
    let theorem
    while ((theorem = this.queue.shift())) {
      const contradiction = this.apply(theorem)
      if (contradiction) {
        return { kind: 'contradiction', contradiction }
      }
    }

    return { kind: 'derivations', derivations: this.derivations }
  }

  private apply(
    implication: Theorem
  ): Contradiction<TheoremId, PropertyId> | undefined {
    const a = implication.when
    const c = implication.then
    const av = evaluate(a, this.traits)
    const cv = evaluate(c, this.traits)

    if (av === true && cv === false) {
      return this.contradiction(implication.id, [
        ...properties(a),
        ...properties(c),
      ])
    } else if (av === true) {
      return this.force(implication.id, c, [...properties(a)])
    } else if (cv === false) {
      return this.force(implication.id, negate(a), [...properties(c)])
    }
  }

  private contradiction(
    theorem: TheoremId,
    properties: PropertyId[]
  ): Contradiction<TheoremId, PropertyId> {
    return this.derivations.expand([theorem, properties])
  }

  force(
    theorem: TheoremId,
    formula: Formula<PropertyId>,
    support: PropertyId[] = []
  ): Contradiction<TheoremId, PropertyId> | undefined {
    switch (formula.kind) {
      case 'and':
        return this.forceAnd(theorem, formula, support)
      case 'atom':
        return this.forceAtom(theorem, formula, support)
      case 'or':
        return this.forceOr(theorem, formula, support)
    }
  }

  private forceAtom(
    theorem: TheoremId,
    formula: Atom<PropertyId>,
    support: PropertyId[]
  ): Contradiction<TheoremId, PropertyId> | undefined {
    const property = formula.property

    if (this.traits.has(property)) {
      if (this.traits.get(property) !== formula.value) {
        return this.contradiction(theorem, [property])
      } else {
        return
      }
    }

    this.traits.set(property, formula.value)
    this.derivations.addEvidence(property, formula.value, theorem, support)
    this.queue.mark(property)
  }

  private forceAnd(
    theorem: TheoremId,
    formula: And<PropertyId>,
    support: PropertyId[]
  ): Contradiction<TheoremId, PropertyId> | undefined {
    for (const sub of formula.subs) {
      const contradiction = this.force(theorem, sub, support)
      if (contradiction) {
        return contradiction
      }
    }
  }

  private forceOr(
    theorem: TheoremId,
    formula: Or<PropertyId>,
    support: PropertyId[]
  ): Contradiction<TheoremId, PropertyId> | undefined {
    const result = formula.subs.reduce(
      (
        acc:
          | {
            falses: Formula<PropertyId>[]
            unknown: Formula<PropertyId> | undefined
          }
          | undefined,
        sf: Formula<PropertyId>
      ) => {
        if (!acc) {
          return undefined
        }

        const value = evaluate(sf, this.traits)
        if (value === true) {
          return undefined // Can't force anything
        } else if (value === false) {
          acc.falses.push(sf)
        } else if (acc.unknown) {
          return undefined // Can't determine which to force
        } else {
          acc.unknown = sf
        }
        return acc
      },
      { falses: Array<Formula<PropertyId>>(), unknown: undefined }
    )

    if (!result) return

    const falseProps = result.falses.reduce<PropertyId[]>(
      (acc, f) => acc.concat([...properties(f)]),
      []
    )

    if (result.falses.length === formula.subs.length) {
      return this.contradiction(theorem, falseProps)
    } else if (result.unknown) {
      return this.force(theorem, result.unknown, [...support, ...falseProps])
    }
  }
}

function formatProof<TheoremId, PropertyId>(
  proof: Proof<TheoremId | 'given', PropertyId>
): TheoremId[] | 'tautology' {
  const filtered: TheoremId[] = []
  proof.theorems.forEach((id: TheoremId | 'given') => {
    if (id !== 'given') {
      filtered.push(id)
    }
  })
  return filtered.length > 0 ? filtered : 'tautology'
}
