const I = require('immutable')
const peg = require('pegjs')

const parser = peg.generate(
`Formula "formula" = And / Or / Atom

Atom = neg:Negation? _ prop:Property {
    var value;
    if (neg === '?') {
        value = undefined
    } else if (neg) {
        value = false
    } else {
        value = true
    }
    return { property: prop, value: value }
}

And = _ "(" _ head:Formula tail:(_ Conjunction _ Formula)+ _ ")" _ {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
          result.push(tail[i][3]);
      }
      return { and: result };
    }

Or = _ "(" _ head:Formula tail:(_ Disjunction _ Formula)+ _ ")" _ {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
          result.push(tail[i][3]);
      }
      return { or: result };
    }

_ = (" " / "\\t" / "\\n") *

// /!\ Important /!\
// If you add any new important symbols, make sure that the are also removed
//   from the character set for properties
Negation    "negation"      = "~" / "not " / "?"
Conjunction "conjunction"   = "++" / "+" / "&&" / "&"  // N.B. "+" / "++" breaks!
Disjunction "disjunction"   = "||" / "|"
Property    "property name" = prop:[^~+&|()]+ {
    return prop.join("").trim()
}`
)

class Formula {
  // TODO: fluent-style map.property
  mapProperty(f) {
    return this.map(({
      property,
      value
    }) => ({
      property: f(property),
      value: value
    }))
  }
}

class Compound extends Formula {
  constructor(subs) {
    super()
    this.subs = subs
  }

  map(f) {
    return new this.constructor(this.subs.map(sub => sub.map(f)))
  }

  properties() {
    return this.subs.reduce((acc, sf) => {
      return acc.union(sf.properties())
    }, I.OrderedSet())
  }
}

class Conjunction extends Compound {
  get and() {
    return this.subs
  }

  negate() {
    // eslint-disable-next-line no-use-before-define
    return new Disjunction(this.subs.map(f => f.negate()))
  }

  evaluate(traits) {
    let result = true // by default
    for (let sub of this.subs) {
      const sv = sub.evaluate(traits)
      if (sv === false) { // definitely false
        return false
      }
      if (sv === undefined) { // maybe false
        result = undefined
      }
    }
    return result
  }
}

class Disjunction extends Compound {
  get or() {
    return this.subs
  }

  negate() {
    return new Conjunction(this.subs.map(f => f.negate()))
  }

  evaluate(traits) {
    let result = false
    for (let sub of this.subs) {
      const sv = sub.evaluate(traits)
      if (sv === true) { // definitely true
        return true
      }
      if (sv === undefined) { // maybe true
        result = undefined
      }
    }
    return result
  }
}

class Atom extends Formula {
  constructor({
    property,
    value
  }) {
    super()

    if (typeof(property) === 'object') {
      this.property = I.Map(property)
    } else {
      this.property = property
    }
    this.value = value
  }

  map(f) {
    return new this.constructor(f({
      property: this.property,
      value: this.value
    }))
  }

  properties() {
    return I.OrderedSet([this.property])
  }

  negate() {
    return new this.constructor({
      property: this.property,
      value: !this.value
    })
  }

  evaluate(traits) {
    const trait = traits.get(this.property.get('uid'))
    return trait ? trait.get('value') === this.value : undefined
  }
}

const fromJSON = (json) => {
  if (json.and) {
    return new Conjunction(json.and.map(fromJSON))
  } else if (json.or) {
    return new Disjunction(json.or.map(fromJSON))
  } else if (json.property) {
    return new Atom(json)
  } else {
    const property = Object.keys(json)[0]
    return new Atom({
      property: property,
      value: json[property]
    })
  }
}

const parse = (q) => {
  if (!q) {
    return
  }

  let parsed
  try {
    parsed = parser.parse(q)
  } catch (e) {
    if (q && q.startsWith('(')) {
      return
    } else {
      return parse('(' + q + ')')
    }
  }

  return fromJSON(parsed)
}

const and = (...subs) => new Conjunction(subs)
const or = (...subs) => new Disjunction(subs)
const atom = (p, v) => new Atom({
  property: p,
  value: v
})

const toString = (f) => {
  if (f.and) {
    return '(' + f.and.map(sf => toString(sf)).join(' + ') + ')'
  } else if (f.or) {
    return '(' + f.or.map(sf => toString(sf)).join(' | ') + ')'
  } else {
    const name = f.property.get('name')
    return f.value ? name : '~'+name
  }
}

module.exports = {
  Formula: Formula,
  fromJSON: fromJSON,
  toString: toString,
  parse: parse,
  and: and,
  or: or,
  atom: atom
}
