var hasKnowWarnings = [
  '所有属性都具有固定width/height，需自行删除',
  'backgroundPosition直接设置导致设置背景属性无效。如background: rgba(255, 255, 255, 0.125) none no-repeat scroll right 8px 50% / auto padding-box border-box'
]
// 属性白名单
var whiteList = [
  'margin',
  'padding',
  'background',
  'color',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'border-top',
  'border-bottom',
  'border-left',
  'border-right',
  'width',
  'height',
  'font-size',
  'border-radius',
  'display',
  'flex',
  'flex-direction',
  'align-items',
  'justify-content',
  'transform',
  'z-index',
  'transition',
  'float',
  'text-align',
  'vertical-align',
  'line-height',
  'text-decoration',
  'text-overflow',
  'overflow',
  'list-style',
  'fill', // valid when tagName is SVG
]
var camelWhiteList = whiteList.map(item => camelCase(item))
var blockTag =[
  'DIV',
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'DIV',
  'OL',
  'UL',
  'DL',
  'TABLE',
  'ADDRESS',
  'FORM',
  'BLOCKQUOTE',
]
// 移除无效属性值
var removeMathes = [
  (k, v) => v === 'auto',
  (k, v) => v === 'normal',
  (k, v) => ['transform', 'float'].includes(k) && v === 'none',
  (k, v) => k === 'verticalAlign' && v === 'baseline',
  (k, v) => k === 'position' && v === 'static',
  (k, v) => k === 'overflow' && v === 'visible',
  (k, v) => k === 'margin' && v === '0px',
  (k, v) => k === 'flexDirection' && v === 'row',
  (k, v) => k === 'lineHeight' && v === 'normal',
  (k, v) => k === 'transition' && v === 'all 0s ease 0s',
  (k, v) => k === 'textOverflow' && v === 'clip',
  (k, v, { tagName }) => tagName !== 'A' && k === 'textDecoration',
  (k, v, _, styles) => styles.position === 'relative' && ['top', 'left', 'right', 'bottom'].includes(k) && v === '0px',
  (k, v, { tagName }) => tagName === 'UL' && k === 'listStyleType' && v === 'disc',
  (k, v, { tagName }) => tagName !== 'svg' && k === 'fill',
  (k, v, { tagName }) => k === 'padding' && v === '0px' && tagName !== 'UL',
  (k, v, { tagName }) => {
    if (['top', 'left', 'right', 'bottom'].map(k => camelCase(`border-${k}`)).includes(k)) {
      // 非button标签 -> 移除border属性
      if (tagName !== 'BUTTON' && tagName !== 'INPUT') {
        if (v && !v.startsWith('0px')) return false
        return true
      } else {
        if (v === '0px none rgb(0, 0, 0)') return true
      }
    }
  },
  (k, v, { tagName }) => blockTag.includes(tagName) && k === 'display' && v === 'block',
  (k, v, el) => isDefaultAttributeValue({ k, v, el }),
]
// 唯一类名选择器id
var id = 0
// 最终生成的样式字符串
var styleStr = ''
var cacheElStyles = {}

// <!----------------------------- utils start----------------------------->
function camelCase(word) {
  const camelRE = /-(\w)/
  return word.replace(camelRE, (_, w) => w.toUpperCase())
}
function hyphenCase(word) {
  const hyphenRE = /([a-z])([A-Z])/
  return word.replace(hyphenRE, (_, w, h) => w + '-' + h.toLowerCase())
}

function genId() {
  return `gen${++id}`
}
function isDefaultAttributeValue({ k, v, el }) {
  const { tagName } = el
  let rawValue, newEl

  if (!cacheElStyles[tagName]) {
    newEl = document.createElement(tagName)
    newEl.visiable = false
    document.body.appendChild(newEl)
    // cache
    cacheElStyles[tagName] = getComputedStyle(newEl)
  }
  rawValue = cacheElStyles[tagName][k]
  newEl && newEl.remove()

  return v === rawValue
}
function testUtil(classSelector) {
  if (classSelector === 'body') return document.body
  // d-block f6 text-white no-underline lh-condensed p-3
  return document.querySelector('.' + classSelector.split(' ').join('.'))
}
// <!----------------------------- utils end----------------------------->

function calcNeedPatchedStyle(el) {
  const tagMapEl = document.createElement(el.tagName)
  const baseStyle = getComputedStyle(tagMapEl)

  const needPatched = {}

  Object.keys(baseStyle).forEach(k => {
    if (camelWhiteList.includes(k)) {
      const styles = getComputedStyle(el)
      const current = styles[k]

      // 自定义规则
      const shouldSaveStyle = isSaveCurrentStyle({ k, v: current, el, styles})
      if (shouldSaveStyle) {
        // 过滤属性值
        const shouldRecord = attributeShouldRecord(k, current, el, styles)
        if (shouldRecord && getComputedStyle(tagMapEl)[k] !== current) {
          const camelAttrName = hyphenCase(k)
          let value = styles[k]

          // 校正属性值
          value = correctAttributeValue(camelAttrName, value)
          needPatched[camelAttrName] = value
        }
      }
    }
  })
  return needPatched
}

function generateStyle(style) {
  if (Object.keys(style).length) {
    const id = genId()
    let str = ''
    Object.entries(style).forEach(([k, v]) => {
      str += `${k}: ${v};`
    })
    styleStr += `#${id}{${str}}`
    return id
  }
}

function addStyleAndUpdateClass(el, clone) {
  const patchedStyle = calcNeedPatchedStyle(el)
  const id = generateStyle(patchedStyle)
  if (id) {
    // clone.classList = [id]
    clone.id = id
  }
}

function cloneElementToHtml(el, clone, needReturn = true) {
  addStyleAndUpdateClass(el, clone)
  afterInterceptor(el, clone)
  const deleteEls = []
  el.childNodes && Array.from(el.childNodes).forEach((childNode, idx) => {
    // 注释节点
    if (childNode.nodeType === 8) {
      deleteEls.push(childNode)
    } else {
      if (
        childNode.nodeType !== 3 // 文本节点
      ) {
        cloneElementToHtml(childNode, clone.childNodes[idx], false)
      }
    }
  })

  deleteEls.forEach(el => el.remove())

  if (!needReturn) return
  // const classAttr = clone.classList && clone.classList.length ? `class="${Array.from(clone.classList || []).join(' ')}"` : ''
  const classAttr = clone.id ? `id="${clone.id}"` : ''

  return `
  <html>
    <head>
      <style>
        ${styleStr}
      </style>
    </head>
    <body>
      <${clone.tagName.toLowerCase()} ${classAttr}>
        ${clone.innerHTML}
      </${clone.tagName.toLowerCase()}>
    </body>
  </html>
  `
}

// 过滤属性值
function attributeShouldRecord(k, v, el, styles) {
  for (let i = 0; i < removeMathes.length; i++) {
    if (removeMathes[i](k, v, el, styles)) {
      return false
    }
  }

  return true
}

// 校正属性值
function correctAttributeValue(camelAttrName, value) {
  // fontSize 校正
  if (camelAttrName === 'font-size') {
    value = (Number(value.split('px')[0]) - 1) + 'px'
  }

  return value
}

// <!----------------------------- userInterface start----------------------------->
// 是否匹配自定义规则
function isSaveCurrentStyle({ k, v, el, styles }) {
  return true
}
// 自定义拦截器
function afterInterceptor(el, clone) {
  if (location.href.includes('jenkins')) {
    // test website:   https://ci.jenkins.io/view/Projects/builds
    const base = 'https://ci.jenkins.io'
    if (el.tagName === 'IMG') {
      clone.setAttribute('src', base + el.getAttribute('src'))
    }
  }
}
// <!----------------------------- userInterface end----------------------------->

// 启动应用
function setup(el) {
  const clone = el.cloneNode(true)

  const html = cloneElementToHtml(el, clone)
  // console.clear()
  console.log(hasKnowWarnings.length ? hasKnowWarnings : '');
  console.log(html)
}

setup(
  testUtil(
    'body'
  )
)