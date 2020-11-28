import type { Formula } from '../Formula'

export type Id = string

export type Evidence<Id> =
  | {
      theorem: Id | 'given'
      properties: Id[]
    }
  | 'given'

export interface Implication<TheoremId = Id, PropertyId = Id> {
  id: TheoremId
  when: Formula<PropertyId>
  then: Formula<PropertyId>
}

export { Proof } from '../Trait'
