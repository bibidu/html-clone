// 属性白名单
var whiteList = [
  'margin',
  // 'margin-left',
  // 'margin-right',
  // 'margin-top',
  // 'margin-bottom',
  'padding',
  // 'padding-left',
  // 'padding-right',
  // 'padding-top',
  // 'padding-bottom',
  'background',
  'color',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  // 'border',
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
]
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
  (k, v) => k === 'transform' && v === 'none',
  (k, v) => k === 'verticalAlign' && v === 'baseline',
  (k, v) => k === 'position' && v === 'static',
  (k, v) => k === 'overflow' && v === 'visible',
  (k, v) => k === 'margin' && v === '0px',
  (k, v, { tagName }) => tagName !== 'INPUT' && k.startsWith('border') && v.startsWith('0px'),
  (k, v, { tagName }) => k === 'padding' && v === '0px' && tagName !== 'UL',
  (k, v, { tagName }) => blockTag.includes(tagName) && k === 'display' && v === 'block',
  (k, v) => k === 'lineHeight' && v === 'normal',
  (k, v) => k === 'textAlign' && v === 'start',
  (k, v) => k === 'textAlign' && v === 'left',
  (k, v) => k === 'transition' && v === 'all 0s ease 0s',
  (k, v) => k === 'textOverflow' && v === 'clip',
  (k, v, { tagName }) => tagName !== 'A' && k === 'textDecoration',
  (k, v, _, styles) => styles.position === 'relative' && ['top', 'left', 'right', 'bottom'].includes(k) && v === '0px',
  (k, v, { tagName }) => tagName === 'UL' && k === 'listStyleType' && v === 'disc',
]
// 唯一类名选择器id
var id = 0
// 最终生成的样式字符串
var styleStr = ''

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
// <!----------------------------- utils end----------------------------->

function calcNeedPatchedStyle(el) {
  const tagMapEl = document.createElement(el.tagName)
  const baseStyle = getComputedStyle(tagMapEl)

  const needPatched = {}

  const camelWhiteList = whiteList.map(item => camelCase(item))
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
    styleStr += `.${id}{${str}}`
    return id
  }
}

function addStyleAndUpdateClass(el, clone) {
  const patchedStyle = calcNeedPatchedStyle(el)
  const id = generateStyle(patchedStyle)
  if (id) {
    clone.classList = [id]
  }
}

function cloneElementToHtml(el, clone, needReturn = true) {
  addStyleAndUpdateClass(el, clone)
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
  const classAttr = clone.classList && clone.classList.length ? `class="${Array.from(clone.classList || []).join(' ')}"` : ''

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
  // const { tagName } = el
  // switch(tagName) {
  //   case 'INPUT': {
  //     if (k === 'border' && v === 'none') {
  //       return false
  //     }
  //   }
  //   default: {
  //     return true
  //   }
  // }
}

// 校正属性值
function correctAttributeValue(camelAttrName, value) {
  // fontSize 校正
  if (camelAttrName === 'font-size') {
    value = (Number(value.split('px')[0]) - 1) + 'px'
  }

  return value
}

// 是否匹配自定义规则
// true -> 保存该样式
function isSaveCurrentStyle({ k, v, el, styles}) {
  // if (el.parentNode.classList[0] === 'meta-list') {
  //   return false
  // }

  return true
}

// 启动应用
function setup(el) {
  const clone = el.cloneNode(true)

  const html = cloneElementToHtml(el, clone)
  // console.clear()
  console.log(html)
}

setup(document.querySelector(
  'body'
))