var hasKnowWarnings = [
  '所有属性都具有固定width/height，需自行删除',
  'backgroundPosition直接设置导致设置背景属性无效。如background: rgba(255, 255, 255, 0.125) none no-repeat scroll right 8px 50% / auto padding-box border-box'
]
// 节省计算时间
var defaultValue = {
  fontSize: {
    'default': 16,
    h1: 32,
    h2: 24,
    h3: 18.72,
    h4: 16,
    h5: 13.28,
    h6: 12,
  }
}
// 属性白名单
var whiteList = [
  'margin',
  'padding',
  'background',
  'background-image',
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
  (k, v, el, styles) => isDefaultAttributeValue({ k, v, el }) || isInValidAttributeValue({ k, v, el }) || isHeritSourceAttributeValue({ k, v, el, styles }),
]
var canInheritStyleName = [
  'fontSize',
  'color',
  'lineHeight',
  'fontWeight',
  'textAlign',
  'visibility',
  'cursor'
]
// 需要最终移除的属性
var clearAttrNames = [
  'style'
]
// 唯一类名选择器id
var id = 0
var id2 = 0
// 最终生成的样式字符串
var styleStr = ''
// 缓存tagName对应的ComputedStyle
var cacheElStyles = {}
// 是否对fontSize作近似处理
var fontSizeSimilarize = true

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
function genId2() {
  return `gen${++id2}`
}

function safeSetObj(obj, index, k, v) {
  if (!obj[index]) {
    obj[index] = {}
  }
  obj[index][k] = v
}
// var defaultValue = {
//   fontSize: {
//     'default': 16,
//     h1: 32,
/**
 * 是否是继承而来的属性
 * 
 */
function isHeritSourceAttributeValue({ k, v, el, styles }) {
  const isInlineNode = styles.display === 'inline' || styles.display === 'inline-block'
  if (isInlineNode && canInheritStyleName.includes(k)) {
    const parent = el.parentNode
    const parentStyle = getComputedStyle(parent)
    const parentMapValue = parentStyle[k]

    // fontSize 单独处理
    if (k === 'fontSize') {
      const elMapFontSize = fontSizeSimilarize ? Math.round(extractFontSize(styles.fontSize)) : extractFontSize(styles.fontSize)

      // fontSize的值和tagName对应的值相等 则忽略该属性
      const tagNameMapFontSize = defaultValue.fontSize[el.tagName.toLowerCase()] || defaultValue.fontSize.default
      const similarized = fontSizeSimilarize ? Math.round(tagNameMapFontSize) : tagNameMapFontSize
      if (similarized === elMapFontSize) return true

      // fontSize的值和父级相等 则忽略该属性
      const parentMapFontSize = fontSizeSimilarize ? Math.round(extractFontSize(parentMapValue)) : extractFontSize(parentMapValue)

      if (elMapFontSize === parentMapFontSize) return true
    }

    return parentMapValue === v
  }
}
/**
 * 是否是无效的属性值
 */
function isInValidAttributeValue({ k, v, el }) {
  /* 属性的值是否无效 */
  switch(k) {
    case 'borderTop':
    case 'borderBottom':
    case 'borderLeft':
    case 'borderRight':
      return !['INPUT', 'BUTTON'].includes(el.tagName) && v.startsWith('0px')

    case 'textDecoration':
      return !['A'].includes(el.tagName)

    case 'display': 
      return Boolean(v === 'none')
    
    case 'visible':
      return Boolean(!v)
    
    case 'opacity':
      return Boolean(!v)
    
    case 'listStyle':
      return !['UL', 'LI'].includes(el.tagName)
  
    case 'margin':
    case 'padding':
      return !['UL', 'LI'].includes(el.tagName) && ['0px'].includes(v)
  }

  /* 属性的组合是否无效 */
  // 块元素无需设置display block
  if (k === 'display' && v === 'block' && blockTag.includes(el.tagName)) 
    return true
  // 行内元素无需设置display inline
  if (k === 'display' && v === 'inline' && !blockTag.includes(el.tagName)) 
    return true
  
}
/**
 * 是否是元素的默认值
 * 由于getComputedStyle返回的是计算后的样式，所以当不同的样式环境下，表现出的样式默认值不同，如position的默认值可以是0px或auto
 * 所以考虑对不同的样式名进行单独判断
 */
function isDefaultAttributeValue({ k, v, el }) {
  switch(k) {
    case 'position':
      return ['0px', 'auto', 'static'].includes(v)

    case 'top':
    case 'bottom':
    case 'left':
    case 'right':
      return ['0px', 'auto'].includes(v)

    case 'flexDirection':
      return ['row'].includes(v)

    case 'transform':
    case 'backgroundImage':
      return ['none'].includes(v)
    
    case 'zIndex':
      return ['auto'].includes(v)
    
    case 'float':
      return ['none'].includes(v)

    case 'verticalAlign':
      return ['baseline'].includes(v)

    case 'borderRadius':
      return ['0px'].includes(v)
    
    case 'overflow':
      return ['visible', 'auto'].includes(v)

    case 'justifyContent':
    case 'alignItems':
    case 'lineHeight':
      return ['normal'].includes(v)
    
    case 'width': 
    case 'height': 
      return ['auto'].includes(v)
    
    case 'fill':
      return ['rgb(0, 0, 0)'].includes(v)

    case 'transition':
      return ['all 0s ease 0s'].includes(v)

    case 'textOverflow': 
      return ['clip'].includes(v)

    case 'textDecoration':
      return ['underline'].includes(v)

    case 'textAlign':
      return ['start', 'left'].includes(v)

    case 'flex':
      return ['0 1 auto'].includes(v)
    
    default:
      return false
  }
}
// 提取单位像素中的值，如16px -> 16
function extractFontSize(withUnit) {
  return Number(withUnit.split('px')[0])
}

function testUtil(classSelector) {
  if (classSelector === 'body') return document.body
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
        const shouldDeleteEl = elShouldDelete(k, current, el, styles)
        if (!shouldDeleteEl) {
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
  clearAttrNames.forEach(name => clone.removeAttribute(name))
}

function cloneElementToHtml(el, clone, needReturn = true) {
  addStyleAndUpdateClass(el, clone)
  afterInterceptor(el, clone)
  const deleteEls = []
  el.childNodes && Array.from(el.childNodes).forEach((childNode, idx) => {
    // 注释节点
    if (childNode.nodeType === 8 || ['SCRIPT', 'LINK'].includes(childNode.tagName)) {
      deleteEls.push(clone.childNodes[idx])
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
// 删除隐藏元素
function elShouldDelete(k, v, el, styles) {
  if (el.style && el.style.display === 'none' || styles.display === 'none') {
    el.remove()
    return true
  }
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
    'comment-list-box'
  )
)