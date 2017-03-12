const Fuse = require('fuse.js')
const I = require('immutable')

// TODO: unify w/ fuse usage in Filter.jsx
class Finder {
  constructor(props) {
    this.records = {}
    props.forEach(rec => {
      this.records[rec.get('uid')] = rec
    })

    this.fuse = new Fuse(props.toJS(), {
      caseSensitive: false,
      shouldSort: true,
      keys: ['name', 'aliases'],
      id: 'uid',
      threshold: 0.4
    })
  }

  getId(p) {
    return this.fuse.search(p)[0]
  }

  suggestionsFor(str, limit) {
    return this.search(str, limit).map(id => this.records[id])
  }

  search(str, limit) {
    str = str || ''
    let ids = this.fuse.search(str)

    if (limit) {
      ids = ids.slice(0, limit)
    }

    return I.List(ids)
  }
}

export default Finder
