import markdown from '../markdown'

it('can render markdown with embedded tex', () => {
  const input =
`Here is some text with markdown stuff

* $d(x_0, x_1) = u$ and also $v_u$
* other text

\\(\\{ 2 * x | x \\in U \\}\\)`

  const expected =
`<p>Here is some text with markdown stuff</p>
<ul>
<li>$d(x_0, x_1) = u$ and also $v_u$</li>
<li>other text</li>
</ul>
<p>\\(\\{ 2 * x | x \\in U \\}\\)</p>`

  const result = markdown(input)

  expect(markdown(input)).toEqual(expected)
})

it('handles non-replacements', () => {
  const input = '_Hello_ world'

  expect(markdown(input)).toEqual('<p><em>Hello</em> world</p>')
})
