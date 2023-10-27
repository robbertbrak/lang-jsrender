import {jsrenderLanguage} from "../dist/index.js"
import {testTree} from "@lezer/generator/dist/test"
import {ParserConfig} from "@lezer/lr"

let parser = jsrenderLanguage.parser

function test(name: string, code: string, tree: string, options?: ParserConfig) {
  it(name, () => testTree((options ? parser.configure(options) : parser).parse(code.trim()), tree))
}

describe("Liquid parsing", () => {
  test("Insert", `One {{: hello.there }}`, "Template(Text, Insert(DirectiveContent))")

  test("If",
`A 
{{if foo}} 
  B {{> c}} D
{{/if}}`,
`
Template(Text,
  IfDirective(
    IfOpen("{{",if,DirectiveContent,"}}"),
    Text,Insert("{{",">",DirectiveContent,"}}"),Text,
    IfClose("{{/",if,"}}")
  )
)
`)

  test("Unless",
`A 
{{unless foo}} 
  B {{:c}} D
{{/unless}}`,
`
Template(Text,
  UnlessDirective(
    UnlessOpen("{{",unless,DirectiveContent,"}}"),
    Text,Insert("{{",":",DirectiveContent,"}}"),Text,
    UnlessClose("{{/",unless,"}}")
  )
)
`)

  test("For",
`A 
{{for foo}} 
  B {{:c}} D
{{/for}}`,
`
Template(Text,
  ForDirective(
    ForOpen("{{",for,DirectiveContent,"}}"),
    Text,Insert("{{",":",DirectiveContent,"}}"),Text,
    ForClose("{{/",for,"}}")
  )
)`)

  test("Comment", `A {{!-- B -- C -- D --}} E`, `Template(Text, Comment, Text)`)
})
