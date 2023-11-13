import {Language, LRLanguage, LanguageSupport, foldNodeProp, foldInside} from "@codemirror/language"
import {html} from "@codemirror/lang-html"
import {styleTags, tags as t} from "@lezer/highlight"
import {parseMixed} from "@lezer/common"
import {parser} from "./jsrender.grammar"
import {jsrenderCompletionSource, JsrenderCompletionConfig} from "./complete"

const tagLanguage = LRLanguage.define({
  name: "jsrender",
  parser: parser.configure({
    props: [
      styleTags({
        "if else unless for": t.controlKeyword,
        DirectiveContent: t.attributeValue,
        "Comment!": t.blockComment,
        "{{ }}": t.brace,
        '"{{/"': t.brace,
        "( )": t.paren,
        ": >": t.punctuation,
      }),
      foldNodeProp.add({
        IfDirective: foldInside,
        UnlessDirective: foldInside,
        ForDirective: foldInside,
      })
    ]
  })
})

const baseHTML = html()

function makeJsrender(base: Language) {
  return tagLanguage.configure({
    wrap: parseMixed(node => node.type.isTop ? {
      parser: base.parser,
      overlay: n => n.name == "Text"
    } : null)
  }, "jsrender")
}

/// A language provider for JsRender templates.
export const jsrenderLanguage = makeJsrender(baseHTML.language)

/// Liquid template support.
export function jsrender(config: JsrenderCompletionConfig & {
  /// Provide an HTML language configuration to use as a base.
  base?: LanguageSupport
} = { schemaInfo: {}, schemaRoot: "" }) {
  let base = config.base || baseHTML
  let lang = base.language == baseHTML.language ? jsrenderLanguage : makeJsrender(base.language)
  return new LanguageSupport(lang, [
    base.support,
    lang.data.of({autocomplete: jsrenderCompletionSource(config)}),
    base.language.data.of({closeBrackets: {brackets: [""]}})
  ])
}
