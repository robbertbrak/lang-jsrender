import {EditorState} from "@codemirror/state"
import {syntaxTree} from "@codemirror/language"
import {CompletionContext, CompletionResult, Completion} from "@codemirror/autocomplete"
import {SyntaxNode} from "@lezer/common"

function completions(words: string, type: string): readonly Completion[] {
  return words.split(" ").map(label => ({label, type}))
}

const Tags = completions("if else unless for", "keyword")

function findContext(context: CompletionContext): {type: string, node?: SyntaxNode, target?: SyntaxNode, from?: number} | null {
  let {state, pos} = context
  let node = syntaxTree(state).resolveInner(pos, -1).enterUnfinishedNodesBefore(pos)
  let before = node.childBefore(pos)?.name || node.name
  if (node.name == "FilterName")
    return {type: "filter", node}
  if (context.explicit && before == "|")
    return {type: "filter"}
  if (node.name == "TagName")
    return {type: "tag", node}
  if (context.explicit && before == "{%")
    return {type: "tag"}
  if (node.name == "PropertyName" && node.parent!.name == "MemberExpression")
    return {type: "property", node, target: node.parent!}
  if (node.name == "." && node.parent!.name == "MemberExpression")
    return {type: "property", target: node.parent!}
  if (node.name == "MemberExpression" && before == ".")
    return {type: "property", target: node}
  if (node.name == "VariableName")
    return {type: "expression", from: node.from}
  let word = context.matchBefore(/[\w\u00c0-\uffff]+$/)
  if (word) return {type: "expression", from: word.from}
  if (context.explicit && node.name != "CommentText" && node.name != "StringLiteral" &&
      node.name != "NumberLiteral" && node.name != "InlineComment")
    return {type: "expression"}
  return null
}

/// Configuration options to
/// [`jsrenderCompletionSource`](#lang-jsrender.jsrenderCompletionSource).
export type JsrenderCompletionConfig = {
  /// Adds additional completions when completing a Jsrender tag.
  tags?: readonly Completion[],
  /// Provides completions for properties completed under the given
  /// path. For example, when completing `user.address.`, `path` will
  /// be `["user", "address"]`.
  properties?: (path: readonly string[], state: EditorState) => readonly Completion[]
}

function resolveProperties(state: EditorState, node: SyntaxNode,
                           properties?: (path: readonly string[], state: EditorState) => readonly Completion[]) {
  let path = []
  for (;;) {
    let obj = node.getChild("Expression")
    if (!obj) return []
    if (obj.name == "VariableName") {
      path.unshift(state.sliceDoc(obj.from, obj.to))
      break
    } else if (obj.name == "MemberExpression") {
      let name = obj.getChild("PropertyName")
      if (name) path.unshift(state.sliceDoc(name.from, name.to))
      node = obj
    } else {
      return []
    }
  }

  return properties ? properties(path, state) : []
}

/// Returns a completion source for jsrender templates. Optionally takes
/// a configuration that adds additional custom completions.
export function jsrenderCompletionSource(config: JsrenderCompletionConfig = {}) {
  let tags = config.tags ? config.tags.concat(Tags) : Tags
  let properties = config.properties
  return (context: CompletionContext): CompletionResult | null => {
    let cx = findContext(context)
    if (!cx) return null
    let from = cx.from ?? (cx.node ? cx.node.from : context.pos)
    let options

    if (cx.type == "tag") options = tags
    else /* property */ options = resolveProperties(context.state, cx.target!, properties)
    return options.length ? {options, from, validFor: /^[\w\u00c0-\uffff]*$/} : null
  }
}
