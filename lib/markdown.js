const showdown = require('showdown')

const converter = new showdown.Converter()

const markdown = function(text) {
  const jaxs = {}
  let i = 0

  text = text.replace(/(\\\(.*?\\\))/g, function(_, s) {
    jaxs[''+i] = s
    const result = 'FRAG' + i + 'FRAG'
    i++
    return result
  })

  text = text.replace(/(\$.*?\$)/g, function(_, s) {
    jaxs[''+i] = s
    const result = 'FRAG' + i + 'FRAG'
    i++
    return result
  })

  const html = converter.makeHtml(text)

  if (i === 0) { return html }

  return html.replace(/FRAG(\d+)FRAG/g, function(_, i) {
    return jaxs[i]
  })
}

module.exports = markdown
