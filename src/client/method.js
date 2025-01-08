/*
 * Federated Wiki : Method Plugin
 *
 * Licensed under the MIT license.
 * https://github.com/fedwiki/wiki-plugin-method/blob/master/LICENSE.txt
 */

// ############ units ############

let conversions = null

const asValue = obj => {
  if (obj == null) return NaN

  switch (obj.constructor) {
    case Number:
      return obj
    case String:
      return +obj
    case Array:
      return asValue(obj[0])
    case Object:
      return asValue(obj.value)
    default:
      return NaN
  }
}

const asUnits = obj => {
  if (obj == null) return []

  switch (obj.constructor) {
    case Number:
      return []
    case String:
      return []
    case Array:
      return asUnits(obj[0])
    case Object:
      if (obj.units) return obj.units
      if (obj.value) return asUnits(obj.value)
      return []
    case Function:
      return units(obj())
    default:
      return []
  }
}

const parseUnits = string => {
  string = string.toLowerCase()
  string = string.replace(/\bsquare\s+(\w+)\b/, '$1 $1')
  string = string.replace(/\bcubic\s+(\w+)\b/, '$1 $1 $1')
  const units = string.match(/(\w+)/g)
  if (!units) return []
  return units.sort()
}

const parseRatio = string => {
  const ratio = string.match(/^\((.+?)\/(.+?)\)$/)
  if (ratio) {
    return {
      numerator: parseUnits(ratio[1]),
      denominator: parseUnits(ratio[2]),
    }
  }

  const units = string.match(/^\((.+?)\)$/)
  if (units) {
    return parseUnits(units[1])
  }

  return undefined
}

const parseLabel = string => {
  const phrases = string.match(/(\(.+?\)).*?(\(.+?\))?[^(]*$/)
  let result
  if (phrases) {
    result = {
      units: parseRatio(phrases[1]),
    }
    if (phrases[2]) result.from = parseRatio(phrases[2])
  }
  return result
}
const extend = (object, properties) => {
  for (const [key, val] of Object.entries(properties)) {
    object[key] = val
  }
  return object
}

const emptyArray = obj => obj.constructor === Array && obj.length === 0

const simplify = obj => {
  if (obj == null) return NaN

  switch (obj.constructor) {
    case Number:
      return obj
    case String:
      return +obj
    case Array:
      return simplify(obj[0])
    case Object:
      if (obj.units === undefined) return simplify(obj.value)
      else if (emptyArray(obj.units)) return simplify(obj.value)
      else return obj
    case Function:
      return simplify(obj())
    default:
      return NaN
  }
}

const inspect = obj => {
  if (obj == null) return 'nullish'

  switch (obj.constructor) {
    case Number:
      return obj
    case String:
      return obj
    case Array:
      return JSON.stringify(obj).replace(/"/g, '')
    case Object:
      return JSON.stringify(obj).replace(/"/g, '')
    case Function:
      return 'functionish'
    default:
      return 'wierdish'
  }
}

const findFactor = (to, from) => {
  for (const [label, value] of Object.entries(conversions)) {
    if (value.from && isEqual(from, value.from)) {
      if (isEqual(to, value.units)) {
        return asValue(value)
      }
    }
    if (value.from && isEqual(to, value.from)) {
      if (isEqual(from, value.units)) {
        return 1 / asValue(value)
      }
    }
  }
  return null
}

const hasUnits = obj => !emptyArray(asUnits(obj))

const isEqual = (a, b) => inspect(a) === inspect(b)

const coerce = (toUnits, value) => {
  // console.log(`coerce to ${inspect(toUnits)}`);
  const fromUnits = asUnits(simplify(value))

  if (isEqual(toUnits, fromUnits)) {
    return value
  } else {
    const factor = findFactor(toUnits, fromUnits)
    console.log('*** factor', factor)
    if (factor) {
      return { value: factor * asValue(value), units: toUnits }
    } else {
      throw new Error(`can't convert to ${inspect(toUnits)} from ${inspect(fromUnits)}`)
    }
  }
}

const unpackUnits = value => {
  const v = asValue(value)
  const u = asUnits(value)

  if (u.constructor === Array) {
    return [v, u, []]
  } else {
    return [v, u.numerator, u.denominator]
  }
}

const packUnits = (nums, denoms) => {
  const n = [].concat(...nums)
  const d = [].concat(...denoms)
  const keep = []

  for (const unit of d) {
    const where = n.indexOf(unit)
    if (where === -1) {
      keep.push(unit)
    } else {
      n.splice(where, 1)
    }
  }

  if (keep.length) {
    return { numerator: n.sort(), denominator: keep.sort() }
  } else {
    return n.sort()
  }
}

const printUnits = units => {
  if (emptyArray(units)) {
    return ''
  }
  if (units.constructor === Array) {
    return `( ${units.join(' ')} )`
  }
  return `( ${units.numerator.join(' ')} / ${units.denominator.join(' ')} )`
}

// ############ calculation ############

const sum = v => {
  return simplify(
    v.reduce((sum, each) => {
      const toUnits = asUnits(simplify(each))
      const value = coerce(toUnits, sum)
      return { value: asValue(value) + asValue(each), units: toUnits }
    }),
  )
}

const difference = v => {
  // list[0] - list[1]
  const toUnits = asUnits(simplify(v[1]))
  const value = coerce(toUnits, v[0])
  return { value: asValue(value) - asValue(v[1]), units: toUnits }
}

const product = v => {
  return simplify(
    v.reduce((prod, each) => {
      let p, pn, pd, e, en, ed
      ;[p, pn, pd] = unpackUnits(prod)
      ;[e, en, ed] = unpackUnits(each)
      return { value: p * e, units: packUnits([pn, en], [pd, ed]) }
    }),
  )
}

const ratio = v => {
  // list[0] / list[1]
  let n, nn, nd, d, dn, dd
  ;[n, nn, nd] = unpackUnits(v[0])
  ;[d, dn, dd] = unpackUnits(v[1])
  return simplify({ value: n / d, units: packUnits([nn, dd], [nd, dn]) })
}

const avg = v => {
  return sum(v) / v.length
}

const round = n => {
  if (n == null) return '?'
  if (n.toString().match(/\.\d\d\d/)) {
    return n.toFixed(2)
  } else {
    return n
  }
}

const annotate = text => {
  if (text == null) return ''
  return `<span title="${text}">*</span>`
}

const print = (report, value, hover, line, comment, color, linenum = 0, unpatched = value) => {
  if (report == null) {
    return
  }
  let long = ''
  if (line.length > 40) {
    long = line
    line = `${line.substr(0, 20)} ... ${line.substr(-15)}`
  }
  report.push(`
    <tr style="background:${color};">
      <td class="value"
        data-value="${asValue(unpatched)}"
        data-linenum="${linenum}"
        style="width: 20%; text-align: right; padding: 0 4px;"
        title="${hover || ''}">
          <b>${round(asValue(value))}</b>
      <td title="${long}">${line}${annotate(comment)}</td>
    `)
}

// ############ expression ############

const ident = (str, syms) => {
  if (str.match(/^\d+(\.\d+)?(e\d+)?$/)) {
    return Number(str)
  } else {
    const regexp = new RegExp(`\\b${str}\\b`)
    for (const [label, value] of Object.entries(syms)) {
      if (label.match(regexp)) return value
    }
    throw new Error(`can't find value for '${str}'`)
  }
}

const lexer = (str, syms = {}) => {
  const buf = []
  let tmp = ''
  let i = 0

  while (i < str.length) {
    const c = str[i++]
    if (c === ' ') continue

    if (['+', '-', '*', '/', '(', ')'].includes(c)) {
      if (tmp) {
        buf.push(ident(tmp, syms))
        tmp = ''
      }
      buf.push(c)
      continue
    }
    tmp += c
  }

  if (tmp) buf.push(ident(tmp, syms))
  return buf
}

const parser = lexed => {
  // term : fact { (*|/) fact }
  // fact : number | '(' expr ')'
  const fact = () => {
    const c = lexed.shift()
    if (typeof c === 'number' || typeof c === 'object') return c

    if (c === '(') {
      const result = expr()
      if (lexed.shift() !== ')') throw new Error('missing paren')
      return result
    }
    throw new Error('missing value')
  }

  const term = () => {
    let c = fact()
    while (['*', '/'].includes(lexed[0])) {
      const o = lexed.shift()
      if (o === '*') c = product([c, term()])
      if (o === '/') c = ratio([c, term()])
    }
    return c
  }

  const expr = () => {
    let c = term()
    while (['+', '-'].includes(lexed[0])) {
      const o = lexed.shift()
      if (o === '+') c = sum([c, term()])
      if (o === '-') c = difference([c, term()])
    }
    return c
  }

  return expr()
}

// ############ interpreter ############

const dispatch = (state, done) => {
  state.list ||= []
  state.input ||= {}
  state.output ||= {}
  state.local ||= {}
  state.patch ||= {}
  state.lines ||= state.item.text.split('\n')
  state.linenum ||= 0
  state.linenum += 1

  const line = state.lines.shift()
  if (line == null) return done(state)

  const attach = search => {
    for (const elem of wiki.getDataNodes(state.div)) {
      const source = $(elem).data('item')
      if (source.text.indexOf(search) >= 0) {
        return source.data
      }
    }
    throw new Error(`can't find dataset with caption ${search}`)
  }

  const lookup = v => {
    const table = attach('Tier3ExposurePercentages')
    if (isNaN(v[0]) || isNaN(v[1])) return NaN

    const row = table.find(row => asValue(row.Exposure) === v[0] && asValue(row.Raw) === v[1])

    if (!row) throw new Error(`can't find exposure ${v[0]} and raw ${v[1]}`)
    return asValue(row.Percentage)
  }

  const polynomial = (v, subtype) => {
    const table = attach('Tier3Polynomials')
    const row = table.find(row => `${row.SubType} Scaled` === subtype && asValue(row.Min) <= v && asValue(row.Max) > v)

    if (!row) throw new Error(`can't find applicable polynomial for ${v} in '${subtype}'`)

    let result = asValue(row.C0)
    result += asValue(row.C1) * v
    result += asValue(row.C2) * Math.pow(v, 2)
    result += asValue(row.C3) * Math.pow(v, 3)
    result += asValue(row.C4) * Math.pow(v, 4)
    result += asValue(row.C5) * Math.pow(v, 5)
    result += asValue(row.C6) * Math.pow(v, 6)

    if (asValue(row['One minus'])) result = 1 - result
    return Math.min(1, Math.max(0, result))
  }

  const show = (list, legend) => {
    const value = sum(list)
    if (emptyArray(asUnits(parseLabel(legend)))) {
      legend += `<br>${printUnits(asUnits(value))}`
    }
    const readout = Number(asValue(value)).toLocaleString('en')
    state.show ??= []
    state.show.push({ readout, legend })
    return value
  }

  const apply = (name, list, label = '') => {
    let result
    switch (name) {
      case 'SUM':
        result = sum(list)
        break
      case 'AVG':
      case 'AVERAGE':
        result = avg(list)
        break
      case 'MIN':
      case 'MINIMUM':
        result = Math.min(...list)
        break
      case 'MAX':
      case 'MAXIMUM':
        result = Math.max(...list)
        break
      case 'RATIO':
        result = ratio(list)
        break
      case 'ACCUMULATE':
        result = sum(list) + (output[label] || input[label] || 0)
        break
      case 'FIRST':
        result = list[0]
        break
      case 'PRODUCT':
        result = product(list)
        break
      case 'LOOKUP':
        result = lookup(list)
        break
      case 'POLYNOMIAL':
        result = polynomial(list[0], label)
        break
      case 'SHOW':
        result = show(list, label)
        break
      case 'CALC':
        result = parser(lexer(label, state.local))
        break
      default:
        throw new Error(`don't know how to '${name}'`)
    }

    const toUnits = asUnits(parseLabel(label))
    if (name === 'CALC' || emptyArray(toUnits)) {
      return result
    }
    return coerce(toUnits, result)
  }

  let unpatched = null
  const patch = value => {
    unpatched = value
    return state.patch[state.linenum] || value
  }

  let color = '#eee'
  let value = null,
    comment = null,
    hover = null,
    input = state.input
  conversions = input
  const output = state.output
  const local = state.local
  let list = state.list
  let label = null

  try {
    let args

    // 99.9 Label (units)
    if ((args = line.match(/^([0-9.eE-]+) +([\w .%(){},&*/+-]+)$/))) {
      let result = patch(+args[1])
      const units = parseLabel((label = args[2]))
      result = units ? extend({ value: result }, units) : result
      local[label] = output[label] = value = result
    }

    // OPERATION Label (units)
    else if ((args = line.match(/^([A-Z]+) +([\w .%(){},&*/+-]+)$/))) {
      value = apply(args[1], list, args[2])
      list = []
      const count = list.length
      color = '#ddd'
      hover = `${args[1]} of ${count} numbers\n= ${asValue(value)} ${printUnits(asUnits(value))}`
      label = args[2]

      if ((output[label] != null || input[label] != null) && !state.item.silent) {
        const previous = asValue(output[label] || input[label])
        const change = value / previous - 1
        if (Math.abs(change) > 0.0001) {
          comment = `previously ${previous}\nΔ ${round(change * 100)}%`
        }
      }
      local[label] = output[label] = value
      if (state.item.checks && state.item.checks[label] !== undefined) {
        const v = state.item.checks[label]
        if (asValue(v).toFixed(4) !== asValue(value).toFixed(4)) {
          color = '#faa'
          label += ` != ${asValue(v).toFixed(4)}`
          if (state.caller) state.caller.errors.push({ message: label })
        }
      }
    }

    // OPERATION
    else if ((args = line.match(/^([A-Z]+)$/))) {
      let count
      ;[value, list, count] = [apply(args[1], list), [], list.length]
      value = patch(value)
      local[args[1]] = value
      color = '#ddd'
      hover = `${args[1]} of ${count} numbers\n= ${asValue(value)} ${printUnits(asUnits(value))}`
    }

    // 99.9
    else if (line.match(/^[0-9.eE-]+$/)) {
      value = patch(+line)
      label = ''
    }

    // Label
    else if ((args = line.match(/^ *([\w .%(){},&*/+-]+)$/))) {
      if (output[args[1]]) {
        local[args[1]] = value = patch(output[args[1]])
      } else if (input[args[1]]) {
        local[args[1]] = value = patch(input[args[1]])
      } else {
        color = '#edd'
        comment = `can't find value of '${line}'`
      }
    } else {
      color = '#edd'
      comment = `can't parse '${line}'`
    }
  } catch (err) {
    color = '#edd'
    value = null
    // console.log( "trouble", inspect( statck))
    comment = err.message
  }
  if (state.caller && color == '#edd') {
    state.caller.errors.push({ message: comment })
  }
  state.list = list
  if (value && !isNaN(asValue(value))) state.list.push(value)
  //console.log(`${line} => ${inspect(state.list)} ${comment || ''}`)
  print(state.report, value, hover, label || line, comment, color, state.linenum, unpatched)
  //console.log(state)
  dispatch(state, done)
}

// ############ interface ############

const bind = (div, item) => {}
const emit = (div, item, done) => {
  let input = {}
  let output = {}

  const refresh = state => {
    if (state.show) {
      state.div.addClass('data')
      const $show = $('<div>')
      state.div.append($show)
      for (const each of state.show) {
        $show.append(
          $(`
          <p class=readout>${each.readout}</p>
          <p class=legend>${each.legend}</p>
          `),
        )
      }
    } else {
      const text = state.report.join('\n')
      const table = $('<table style="width:100%; background:#eee; padding:.8em; margin-bottom:5px;"/>').html(text)
      state.div.append(table)
      if (input['debug']) {
        for (const [label, value] of state.output) {
          state.div.append($(`<p class=error>${label} =><br> ${inspect(value)}</p>`))
        }
      }
      if (output['debug']) {
        for (const [label, value] of state.input) {
          state.div.append($(`<p class=error>${label} =><br> ${inspect(value)}</p>`))
        }
      }
    }
  }

  const scrub = (e, $td, $b) => {
    const patch = {}
    if (e.shiftKey) {
      // from http://bugs.jquery.com/ticket/8523#comment:16
      if (typeof e.offsetX == 'undefined') {
        e.offsetX = e.pageX - $(e.target).offset().left
        // console.log 'scrub', e
      }
      const width = $td.width() / 2
      let scale = Math.pow(2, (e.offsetX - width) / width)
      scale = Math.min(2, Math.max(0.5, scale))
      patch[$td.data('linenum')] = $td.data('value') * scale
    }
    state = { div, item, input, output, report: [], patch }
    dispatch(state, state => {
      div.empty()
      refresh(state)
    })
  }

  const handleScrub = e => {
    const $target = $(e.target)
    if ($target.is('td')) {
      $(div).triggerHandler('thumb', $target.text())
    }
    if ($target.is('td.value')) {
      scrub(e, $target, $target.find('b'))
    }
    if ($target.is('b')) {
      scrub(e, $target.parent(), $target)
    }
  }

  const candidates = $(`.item:lt(${$('.item').index(div)})`)
  for (let elem of candidates) {
    elem = $(elem)
    if (elem.hasClass('radar-source')) {
      Object.assign(input, elem.get(0).radarData())
    } else if (elem.hasClass('data')) {
      let itemData = elem.data('item')
      if (itemData && itemData.data && itemData.data[0]) {
        Object.assign(input, itemData.data[0])
      }
    }
  }

  div.addClass('radar-source')
  div.get(0).radarData = () => output

  div.on('mousemove', e => handleScrub(e))
  div.on('dblclick', e => {
    if (e.shiftKey) {
      wiki.dialog('JSON for Method plugin', $('<pre/>').text(JSON.stringify(item, null, 2)))
    } else {
      wiki.textEditor(state.div, state.item)
    }
  })

  let state = { div, item, input, output, report: [] }
  dispatch(state, state => {
    refresh(state)
    setTimeout(done, 10) // slower is better for firefox
  })
}

const evaluate = (caller, item, input, done) => {
  const state = { caller: caller, item: item, input: input, output: {} }
  dispatch(state, (state, input) => {
    done(state.caller, state.output)
  })
}

if (typeof window !== 'undefined') {
  window.plugins.method = { emit, bind, eval: evaluate }
}

export const method =
  typeof window == 'undefined'
    ? { lexer, parser, dispatch, asValue, asUnits, hasUnits, simplify, parseUnits, parseRatio, parseLabel }
    : undefined
