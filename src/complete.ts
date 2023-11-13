import { syntaxTree } from "@codemirror/language"

/// Configuration options to
/// [`jsrenderCompletionSource`](#lang-jsrender.jsrenderCompletionSource).
export type JsrenderCompletionConfig = {
  schemaInfo: any,
  schemaRoot: String
}

export function jsrenderCompletionSource(config: JsrenderCompletionConfig) {
  function findParentDirective(node) {
    while (node != null) {
      if (node.name === 'ForDirective') {
        return 'for';
      } else if (node.name === 'IfDirective') {
        return 'if';
      } else if (node.name === 'UnlessDirective') {
        return 'unless';
      } else {
        node = node.parent;
      }
    }
  }

  function getForDirectiveStack(context) {
    let stack = []

    let {state, pos} = context;
    let node = syntaxTree(state).resolveInner(pos, -1);

    while (node != null) {
      if (node.name === 'ForDirective' && node.firstChild.to < pos) {
        stack.push(node);
        node = node.parent;
      } else {
        node = node.parent;
      }
    }

    return stack;
  }

  function getDataContext(context, stack) {
    var contexts = [config.schemaRoot];
    stack.reverse().forEach((elt) => {
      var currentContext = contexts[contexts.length - 1];
      var options = getArrayCompletions(currentContext);
      let forOpen = elt.firstChild.getChild('DirectiveContent');
      let forStr = context.state.sliceDoc(forOpen.from, Math.min(context.pos, forOpen.to)) || "";
      let lineTokens = forStr.split(" ");

      for (var i = 0; i < lineTokens.length; i++) {
        var eligible = options.filter(function(completion) {
          return lineTokens[i].indexOf(completion.key) === 0;
        });
        if (eligible.length) {
          contexts = contexts.concat(eligible[0].types);
          break;
        }
      }
    });
    return contexts;
  }

  var arrayCompletions = {};

  function getArrayCompletions(context) {
    if (arrayCompletions[context]) return arrayCompletions[context];
    var result = [];
    var props = config.schemaInfo[context];
    if (!props) { return []; }

    Object.keys(props).forEach(function(key) {
      if (typeof props[key] === 'object' && props[key].array) {
        result.push({
          key: key,
          types: [props[key].c]
        });
      } else {
        var c = typeof props[key] === 'object' ? props[key].c : props[key];
        getArrayCompletions(c).forEach(function(completion) {
          result.push({
            key: key + '.' + completion.key,
            types: [c].concat(completion.types)
          });
        });
      }
    });
    arrayCompletions[context] = result;
    return result;
  }

  function arrayLikeCompletions(context) {
    let path = getDataContext(context, getForDirectiveStack(context));
    if (path) {
      let startOfPath = context.matchBefore(/[\w.]*/);
      let completions = getArrayCompletions(path[path.length - 1]).map(completion => {
        return { label: completion.key, type: 'path' }
      });
      return {
        from: Math.min(startOfPath.from, context.pos),
        options: completions,
        validFor: /^[\w.]*$/
      }
    } else {
      return null;
    }
  }

  function pathCompletions(context) {
    let path = getDataContext(context, getForDirectiveStack(context));
    let dataContext: any = path ? path[path.length - 1] : 'UNKNOWN';
    let startOfPath = context.matchBefore(/[\w.]*/);
    let start = startOfPath.from;

    if (dataContext !== 'UNKNOWN') {
      var nodes = startOfPath.text.split('.');
      nodes = nodes.slice(0, nodes.length - 1);
      nodes.forEach(function(node) {
        start += node.length + '.'.length;
        if (dataContext !== 'UNKNOWN' && config.schemaInfo[dataContext][node]) {
          dataContext = config.schemaInfo[dataContext][node];
          dataContext = typeof dataContext === 'object' ? (dataContext.array ? 'UNKNOWN' : dataContext.c) : dataContext;
        } else {
          dataContext = 'UNKNOWN';
        }
      });
    }

    let keys = Object.keys(config.schemaInfo[dataContext] || {});

    return {
      from: Math.min(start, context.pos),
      options: keys.map(key => ({ label: key })),
      validFor: /^[\w.]*$/
    }
  }


  return (context) => {
    let {state, pos} = context
    let nodeBefore = syntaxTree(state).resolveInner(pos, -1);
    let matchBefore = context.matchBefore(/\{{.*/);
    if (!matchBefore) return null;

    let line = matchBefore.text.split("{{").last();

    let textBefore = context.state.sliceDoc(nodeBefore.from, context.pos);
    if (textBefore.endsWith('}')) return null;

    let tagBefore = /[\/a-z]*$/.exec(textBefore)
    if (!tagBefore && !context.explicit) return null
    let from = tagBefore ? nodeBefore.from + tagBefore.index : context.pos;

    let parentDirective = findParentDirective(nodeBefore);

    if (line.match(/^\/[a-z]*$/)) {
      // Close tag
      if (!parentDirective) { return null; }

      return { from: from, options: [{ label: '/' + parentDirective + '}}', type: 'keyword' }], validFor: /^\/[a-z]*$/ };
    } else if (line.match(/^[\/a-z]*$/)) {
      // Keyword completions
      let options = [
        { label: ':', type: 'keyword' },
        { label: 'for', type: 'keyword' },
        { label: 'if', type: 'keyword' },
        { label: 'unless', type: 'keyword' },
      ]
      if (['if', 'unless'].indexOf(parentDirective) !== -1) {
        options.push({ label: 'else', type: 'keyword' })
      }
      if (parentDirective != null && line.length === 0) {
        options.unshift({ label: '/' + parentDirective + '}}', type: 'keyword' })
      }

      return { from: from, options: options, validFor: /^[\/a-z]*$/ }
    } else {
      if (line.startsWith("for ")) {
        // Offer array-like path completions
        if (context.explicit || line === 'for ') {
          return arrayLikeCompletions(context);
        }
      } else {
        // Offer path completions
        if (context.explicit || line.match(/^\w+\s$/) || line.match(/^[:>]$/) || line.match(/\.$/)) {
          return pathCompletions(context);
        }
      }
    }
  }
}
