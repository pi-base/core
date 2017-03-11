const showdown = require('showdown')

const converter = new showdown.Converter()

const markdown = function(text) {
  const jaxs = {}
  var i = 0

  text = text.replace(/(\\\(.*?\\\))/g, function(_, s) {
    jaxs[''+i++] = s
    return 'FRAG' + i + 'FRAG'
  })

  text = text.replace(/(\$.*?\$)/g, function(_, s) {
    jaxs[''+i++] = s
    return 'FRAG' + i + 'FRAG'
  })

  const html = converter.makeHtml(text)

  if (!jaxs) { return html }

  return html.replace(/FRAG(\d+)FRAG/g, function(_, i) {
    return jaxs[i]
  })
}

module.exports = {
  markdown: markdown
}
