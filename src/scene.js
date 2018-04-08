import Layer from './layer'
import Resource from './resource'
import {BaseNode} from 'sprite-core'
import {createCanvas, getContainer} from './platform'
import {setDeprecation} from 'sprite-utils'

const _layerMap = Symbol('layerMap'),
  _zOrder = Symbol('zOrder'),
  _layers = Symbol('layers'),
  _snapshot = Symbol('snapshot'),
  _viewport = Symbol('viewport'),
  _resolution = Symbol('resolution'),
  _resizeHandler = Symbol('resizeHandler')

function sortLayer(paper) {
  const layers = Object.values(paper[_layerMap])

  layers.sort((a, b) => {
    if(b.zIndex === a.zIndex) {
      return b.zOrder - a.zOrder
    }
    return b.zIndex - a.zIndex
  })

  paper[_layers] = layers
}

export default class extends BaseNode {
  constructor(container, options = {}) {
    super()

    container = getContainer(container)
    this.container = container

    if(arguments.length === 3) {
      setDeprecation('Scene(container, width, height)', 'Instead use Scene(container, {viewport, resolution}).')
      /* eslint-disable prefer-rest-params */
      options = {viewport: [arguments[1], arguments[2]]}
      /* eslint-enabel prefer-rest-params */
    }

    this[_zOrder] = 0
    this[_layerMap] = {}
    this[_layers] = []
    this[_snapshot] = createCanvas()

    // scale, width, height, top, bottom, left, right
    // width-extend, height-extend, top-extend, bottom-extend, left-extend, right-extend
    this.stickMode = options.stickMode || 'scale'
    this.stickExtend = !!options.stickExtend
    this.stickOffset = [0, 0]

    this[_resolution] = options.resolution || [...this.viewport]
    const [width, height] = options.viewport || ['', '']
    this.viewport = [width, height]

    // d3-friendly
    this.namespaceURI = 'http://spritejs.org/scene'
    const that = this
    this.ownerDocument = {
      createElementNS(uri, name) {
        return that.layer(name)
      },
    }

    const events = ['mousedown', 'mouseup', 'mousemove',
      'touchstart', 'touchend', 'touchmove',
      'click', 'dblclick']

    this.delegateEvent(...events)
  }

  get width() {
    return this.viewport[0]
  }
  get height() {
    return this.viewport[1]
  }

  // d3-friendly
  insertBefore(node, next) {
    if(this.container) {
      return this.container.insertBefore(node, next)
    }
  }
  appendChild(layer) {
    return this.appendLayer(layer)
  }
  removeChild(layer) {
    return this.removeLayer(layer)
  }
  get layerViewport() {
    const [rw, rh] = this.resolution,
      [vw, vh] = this.viewport,
      stickMode = this.stickMode,
      stickExtend = this.stickExtend

    let width = vw,
      height = vh

    if(!stickExtend) {
      if(stickMode === 'width' || stickMode === 'top' || stickMode === 'bottom') {
        height = Math.min(rh, vw * rh / rw)
      } else if(stickMode === 'height' || stickMode === 'left' || stickMode === 'right') {
        width = Math.min(rw, vh * rw / rh)
      }
    }

    return [width, height]
  }
  updateViewport(layer) {
    const [width, height] = this.layerViewport,
      layers = layer ? [layer] : this[_layers],
      stickMode = this.stickMode,
      stickExtend = this.stickExtend

    layers.forEach((layer) => {
      const canvas = layer.canvas
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      if(!stickExtend && (stickMode === 'width' || stickMode === 'height')) {
        canvas.style.top = '50%'
        canvas.style.left = '50%'
        canvas.style.transform = 'translate(-50%, -50%)'
      } else if(!stickExtend && (stickMode === 'right' || stickMode === 'bottom')) {
        canvas.style.right = '0'
        canvas.style.bottom = '0'
      } else {
        canvas.style.top = '0'
        canvas.style.left = '0'
      }
      if(stickExtend) {
        layer.resolution = this.layerResolution
      }
    })
  }
  get distortion() {
    if(this.stickMode !== 'scale') {
      return 1.0
    }
    return this.viewport[1] * this.resolution[0] / (this.viewport[0] * this.resolution[1])
  }

  set viewport([width, height]) {
    this[_viewport] = [width, height]
    if(width === 'auto' || height === 'auto') {
      if(!this[_resizeHandler]) {
        this[_resizeHandler] = () => this.updateViewport()
        window.addEventListener('resize', this[_resizeHandler])
      }
    } else if(this[_resizeHandler]) {
      window.removeEventListener('resize', this[_resizeHandler])
      delete this[_resizeHandler]
    }
    if(this[_layers].length) {
      this.updateViewport()
    }
  }
  get viewport() {
    let [width, height] = this[_viewport]
    if(width === '' || Number.isNaN(Number(width))) {
      width = this.container.clientWidth
    }
    if(height === '' || Number.isNaN(Number(height))) {
      height = this.container.clientHeight
    }
    return [width, height]
  }

  get layerResolution() {
    const [rw, rh] = this.resolution,
      [vw, vh] = this.viewport,
      stickMode = this.stickMode,
      stickExtend = this.stickExtend

    let width = rw,
      height = rh,
      offsetTop = 0,
      offsetLeft = 0

    if(stickExtend) {
      if(stickMode === 'width' || stickMode === 'top' || stickMode === 'bottom') {
        const vrh = rw * vh / vw
        height = vrh

        if(stickMode === 'width') {
          offsetTop = Math.round((vrh - rh) / 2)
        } else if(stickMode === 'bottom') {
          offsetTop = vrh - rh
        }
      } else if(stickMode === 'height' || stickMode === 'left' || stickMode === 'right') {
        const vrw = rh * vw / vh
        width = vrw

        if(stickMode === 'height') {
          offsetLeft = Math.round((vrw - rw) / 2)
        } else if(stickMode === 'right') {
          offsetLeft = vrw - rw
        }
      }
    }
    this.stickOffset = [offsetLeft, offsetTop]
    return [width, height, offsetLeft, offsetTop]
  }

  set resolution([width, height]) {
    this[_resolution] = [width, height]
    this[_layers].forEach((layer) => {
      layer.resolution = this.layerResolution
    })
  }
  get resolution() {
    return this[_resolution]
  }

  setViewport(width, height) {
    this.viewport = [width, height]
    return this
  }

  setResolution(width, height) {
    this.resolution = [width, height]
    return this
  }

  toGlobalPos(x, y) {
    const resolution = this.layerResolution,
      viewport = this.layerViewport

    x = x * viewport[0] / resolution[0]
    y = y * viewport[1] / resolution[1]

    return [x, y]
  }
  toLocalPos(x, y) {
    const resolution = this.layerResolution,
      viewport = this.layerViewport

    x = x * resolution[0] / viewport[0]
    y = y * resolution[1] / viewport[1]

    return [x, y]
  }
  delegateEvent(...events) {
    events.forEach((event) => {
      if(typeof event === 'string') {
        event = {type: event, passive: true}
      }

      const {type, passive} = event

      this.container.addEventListener(type, (e) => {
        if(!e.target.dataset.layerId || !this[_layerMap][e.target.dataset.layerId]) {
          return
        }

        const layers = this[_layers]
        const evtArgs = {
          originalEvent: e,
          type,
          stopDispatch() {
            this.terminated = true
          },
        }

        // mouse event layerX, layerY value change while browser scaled.
        if(e instanceof CustomEvent) {
          Object.assign(evtArgs, e.detail)
          const {x, y} = evtArgs
          if(x != null && y != null) {
            const [originalX, originalY] = this.toGlobalPos(x, y)
            Object.assign(evtArgs, {
              layerX: x, layerY: y, originalX, originalY, x, y,
            })
          }
        } else {
          const {left, top} = e.target.getBoundingClientRect()
          let originalX,
            originalY

          if(e.changedTouches) { // mobile
            const {clientX, clientY} = e.changedTouches[0]

            originalX = Math.round(clientX - left)
            originalY = Math.round(clientY - top)
          } else {
            originalX = Math.round(e.clientX - left)
            originalY = Math.round(e.clientY - top)
          }

          let [layerX, layerY] = this.toLocalPos(originalX, originalY)
          layerX -= this.stickOffset[0]
          layerY -= this.stickOffset[1]

          Object.assign(evtArgs, {
            layerX, layerY, originalX, originalY, x: layerX, y: layerY,
          })
        }

        for(let i = 0; i < layers.length; i++) {
          const layer = layers[i]

          if(layer.handleEvent) {
            layer.dispatchEvent(type, evtArgs)
          }
        }
      }, {passive})
    })
  }
  dispatchEvent(type, evt) {
    const container = this.container
    container.dispatchEvent(new CustomEvent(type, {detail: evt}))
    super.dispatchEvent(type, evt, true)
  }
  async preload(...resources) {
    const ret = [],
      tasks = []

    for(let i = 0; i < resources.length; i++) {
      const res = resources[i]
      let task

      if(typeof res === 'string') {
        task = Resource.loadTexture(res)
      } else if(Array.isArray(res)) {
        task = Resource.loadFrames(...res)
      } else {
        const {id, src} = res
        task = Resource.loadTexture({id, src})
      }
      if(!(task instanceof Promise)) {
        task = Promise.resolve(task)
      }

      tasks.push(task.then((r) => {
        ret.push(r)
        this.dispatchEvent('preload', {
          target: this, current: r, loaded: ret, resources,
        })
      }))
    }

    await Promise.all(tasks)
    return ret
  }
  layer(id = 'default', opts = {handleEvent: true}) {
    if(typeof opts === 'number') {
      opts = {zIndex: opts}
    }
    if(!this.hasLayer(id)) {
      let zIndex = 0
      if(opts.zIndex != null) {
        zIndex = opts.zIndex
        delete opts.zIndex
      }

      const context = opts.context || createCanvas().getContext('2d')
      const canvas = context.canvas
      canvas.dataset.layerId = id
      canvas.style.position = 'absolute'
      if(this.container.style) {
        if(!this.container.style.position) {
          this.container.style.position = 'relative'
        } if(!this.container.style.overflow) {
          this.container.style.overflow = 'hidden'
        }
      }
      opts.context = context
      const layer = new Layer(opts)
      this.appendLayer(layer, zIndex)
    }

    return this[_layerMap][id]
  }
  appendLayer(layer, zIndex = 0) {
    const id = layer.id

    if(this.hasLayer(id) && this[_layerMap][id] !== layer) {
      throw new Error(`layer ${id} already exists! remove first...`)
    }

    this.removeLayer(layer)

    this[_layerMap][id] = layer
    layer.connect(this, this[_zOrder]++, zIndex)
    this.updateViewport(layer)
    layer.resolution = this.layerResolution

    sortLayer(this)
    return layer
  }
  removeLayer(layer) {
    let layerID
    if(typeof layer === 'string') {
      layerID = layer
      layer = this[_layerMap][layer]
    } else {
      layerID = layer.id
    }

    if(this.hasLayer(layer)) {
      layer.disconnect(this)
      delete this[_layerMap][layerID]
      sortLayer(this)
      return layer
    }

    return null
  }
  hasLayer(layer) {
    let layerID
    if(typeof layer === 'string') {
      layerID = layer
      layer = this[_layerMap][layer]
    } else {
      layerID = layer.id
    }
    return layer && this[_layerMap][layerID] === layer
  }
  async snapshot() {
    const canvas = this[_snapshot]
    const [width, height] = this.viewport

    canvas.width = width
    canvas.height = height

    const layers = this[_layers].slice(0).reverse()
    const ctx = canvas.getContext('2d')

    const renderTasks = layers.map(layer => layer.prepareRender())
    await Promise.all(renderTasks)

    layers.forEach(layer => ctx.drawImage(layer.canvas, 0, 0, width, height))

    return canvas
  }
}
