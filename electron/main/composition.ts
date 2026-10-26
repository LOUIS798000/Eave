/**
 * Real live frosted glass for the blade, drawn by Windows.UI.Composition.
 *
 * Why this exists: DWM's acrylic (`SetWindowCompositionAttribute`) always fills
 * the whole window rectangle and cannot be shaped — measured here with
 * SetWindowRgn, DWMWCP_ROUND and DWM_BB_BLURREGION, all of which were accepted
 * and all of which left the corners tinted. A rectangular sheet under a 24 px
 * rounded blade always leaks four square corners, and the accent adds its own
 * hairline, which is exactly what looked wrong.
 *
 * The compositor can do it properly: a SpriteVisual whose brush is
 *   CompositionBackdropBrush -> GaussianBlur -> CompositionEffectBrush
 * is a live, blurred copy of whatever is behind the window, and a RectangleClip
 * with per-corner radii shapes it. So the glass is finally the same rounded
 * rectangle as the blade, with no window rectangle to leak out of.
 *
 * Everything is driven through koffi: this machine has no C++ or .NET SDK, so
 * WinRT is called through raw COM vtables. The non-obvious parts, all verified
 * on Windows 11 26200:
 *
 *   - The compositor refuses to activate (E_ACCESSDENIED, "caller must
 *     initialize DispatcherQueue") unless the thread owns a DispatcherQueue
 *     created with threadType = DQTYPE_THREAD_CURRENT (2). 1 means
 *     DQTYPE_THREAD_DEDICATED, which builds the queue on another thread.
 *   - WinRT interface methods start at absolute slot 6 (IInspectable owns
 *     0..5). Interop interfaces from *.interop.h (`ICompositorDesktopInterop`,
 *     `IGraphicsEffectD2D1Interop`) derive from IUnknown, so theirs start at 3.
 *   - Pointer out-params need an `_Out_` struct with a single `void *` field; a
 *     bare `void **` is silently dropped and `_Out_ void **` crashes.
 *   - There is no Compositor.Commit(); changes flush on the next frame.
 *   - A bare backdrop brush renders nothing — it is only an effect source.
 *   - RectangleClip uses absolute coordinates, not insets, so Right/Bottom must
 *     be set to the visual's size or the visual is clipped away entirely.
 */
import { BrowserWindow, screen } from 'electron'
import koffi from 'koffi'

export interface GlassRect {
  left: number
  top: number
  width: number
  height: number
}

export interface CornerRadii {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}

export const ZERO_RADII: CornerRadii = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 }

// ─────────────────────────────────────────────────────────────── Win32 flags
const WS_POPUP = 0x80000000
const WS_VISIBLE = 0x10000000
const WS_EX_NOREDIRECTIONBITMAP = 0x00200000
const WS_EX_TOOLWINDOW = 0x00000080
const WS_EX_NOACTIVATE = 0x08000000
const WS_EX_TRANSPARENT = 0x00000020
const WS_EX_TOPMOST = 0x00000008

const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010
const SWP_NOOWNERZORDER = 0x0200

const SW_SHOWNOACTIVATE = 4

// ──────────────────────────────────────────────────────────────── GUID utils
function guidBuf(text: string): Buffer {
  const m = /^\{?([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})\}?$/.exec(
    text.trim()
  )
  if (!m) throw new Error(`bad GUID: ${text}`)
  const buf = Buffer.alloc(16)
  buf.writeUInt32LE(parseInt(m[1], 16), 0)
  buf.writeUInt16LE(parseInt(m[2], 16), 4)
  buf.writeUInt16LE(parseInt(m[3], 16), 6)
  const tail = (m[4] + m[5]).match(/../g) ?? []
  for (let i = 0; i < 8; i++) buf[8 + i] = parseInt(tail[i], 16)
  return buf
}

const IID = {
  ICompositor: guidBuf('{B403CA50-7F8C-4E83-985F-CC45060036D8}'),
  ICompositor2: guidBuf('{735081DC-5E24-45DA-A38F-E32CC349A9A0}'),
  ICompositor7: guidBuf('{D3483FAD-9A12-53BA-BFC8-88B7FF7977C6}'),
  ICompositorDesktopInterop: guidBuf('{29E691FA-4567-4DCA-B319-D0F207EB6807}'),
  ICompositionTarget: guidBuf('{A1BEA8BA-D726-4663-8129-6B5E7927FFA6}'),
  IContainerVisual: guidBuf('{02F6BC74-ED20-4773-AFE6-D49B4A93DB32}'),
  IVisual: guidBuf('{117E202D-A859-4C89-873B-C2AA566788E3}'),
  ISpriteVisual: guidBuf('{08E05581-1AD1-4F97-9757-402D76E4233B}'),
  IVisualCollection: guidBuf('{8B745505-FD3E-4A98-84A8-E949468C6BCB}'),
  ICompositionBrush: guidBuf('{AB0D7608-30C0-40E9-B568-B60A6BD1FB46}'),
  ICompositionClip: guidBuf('{1CCD2A52-CFC7-4ACE-9983-146BB8EB6A3C}'),
  IRectangleClip: guidBuf('{B3E7549E-00B4-5B53-8BE8-353F6C433101}'),
  IPropertyValueStatics: guidBuf('{629BDBC8-D932-4FF4-96B9-8D96C5C1E858}'),
  ICompositionEffectSourceParameterFactory: guidBuf('{B3D9F276-ABA3-4724-ACF3-D0397464DB1C}'),
  IGraphicsEffect: guidBuf('{CB51C0CE-8FE6-4636-B202-861FAA07D8F3}'),
  IGraphicsEffectSource: guidBuf('{2D8F9DDC-4339-4EB9-9216-F9DEB75658A2}'),
  IGraphicsEffectD2D1Interop: guidBuf('{2FC57384-A068-44D7-A331-30982FCF7177}'),
  IUnknown: guidBuf('{00000000-0000-0000-C000-000000000046}'),
  IInspectable: guidBuf('{AF86E2E0-B12D-4C6A-9C5A-D7AA65101E90}')
}

const CLSID_D2D1_GAUSSIAN_BLUR = guidBuf('{1FEB6D69-2FE6-4AC9-8C58-1D7F93E7A6A5}')
const S_OK = 0
const E_NOINTERFACE = 0x80004002 | 0
const E_INVALIDARG = 0x80070057 | 0
const E_BOUNDS = 0x8000000b | 0
const E_FAIL = 0x80004005 | 0
const INSPECTABLE_SLOTS = 6
const VTABLE_SLOTS = 56

// ─────────────────────────────────────────────────────────── koffi bindings
type OutBox = { value: unknown }
type Wrapped = { ptr: unknown; slots: unknown[]; className?: string }

let bindings: ReturnType<typeof loadBindings> | null = null
let bindingsError: string | null = null

function loadBindings() {
  const combase = koffi.load('combase.dll')
  const coremessaging = koffi.load('CoreMessaging.dll')
  const ole32 = koffi.load('ole32.dll')
  const user32 = koffi.load('user32.dll')

  koffi.struct('EdgeDropV2', { x: 'float', y: 'float' })
  // IVisual.Offset is a Vector3. Passing a Vector2 struct here corrupts the
  // stack: the callee reads three floats, not two.
  koffi.struct('EdgeDropV3', { x: 'float', y: 'float', z: 'float' })
  koffi.struct('EdgeDropOut', { value: 'void *' })
  koffi.struct('EdgeDropColor', { a: 'uint8_t', r: 'uint8_t', g: 'uint8_t', b: 'uint8_t' })
  koffi.struct('EdgeDropDQOptions', {
    dwSize: 'uint32_t',
    threadType: 'int',
    apartmentType: 'int'
  })

  const proto = {
    qi: koffi.proto('long EdgeDropQi(void *self, uint8_t *iid, _Out_ EdgeDropOut *out)'),
    addRef: koffi.proto('uint32_t EdgeDropAddRef(void *self)'),
    className: koffi.proto('long EdgeDropClassName(void *self, _Out_ EdgeDropOut *out)'),
    create: koffi.proto('long EdgeDropCreate(void *self, _Out_ EdgeDropOut *out)'),
    createFrom: koffi.proto('long EdgeDropCreateFrom(void *self, void *arg, _Out_ EdgeDropOut *out)'),
    createTarget: koffi.proto(
      'long EdgeDropCreateTarget(void *self, uintptr_t hwnd, int topmost, _Out_ EdgeDropOut *out)'
    ),
    getObj: koffi.proto('long EdgeDropGetObj(void *self, _Out_ EdgeDropOut *out)'),
    putObj: koffi.proto('long EdgeDropPutObj(void *self, void *value)'),
    putObj2: koffi.proto('long EdgeDropPut2(void *self, void *a, void *b)'),
    putV2: koffi.proto('long EdgeDropPutV2(void *self, EdgeDropV2 value)'),
    putV3: koffi.proto('long EdgeDropPutV3(void *self, EdgeDropV3 value)'),
    putFloat: koffi.proto('long EdgeDropPutFloat(void *self, float value)'),
    putBool: koffi.proto('long EdgeDropPutBool(void *self, uint8_t value)'),
    createSingle: koffi.proto(
      'long EdgeDropCreateSingle(void *self, float value, _Out_ EdgeDropOut *out)'
    ),
    createU32: koffi.proto(
      'long EdgeDropCreateU32(void *self, uint32_t value, _Out_ EdgeDropOut *out)'
    ),
    createParam: koffi.proto('long EdgeDropCreateParam(void *self, void *name, _Out_ EdgeDropOut *out)'),
    createFactory: koffi.proto(
      'long EdgeDropCreateFactory(void *self, void *effect, _Out_ EdgeDropOut *out)'
    ),
    createFactoryWithProps: koffi.proto(
      'long EdgeDropCreateFactoryProps(void *self, void *effect, void *props, _Out_ EdgeDropOut *out)'
    ),
    // IGraphicsEffectD2D1Interop
    effectId: koffi.proto('long EdgeFxEffectId(void *self, void *out)'),
    namedMapping: koffi.proto(
      'long EdgeFxNamedMapping(void *self, void *name, void *index, void *mapping)'
    ),
    propCount: koffi.proto('long EdgeFxPropCount(void *self, void *out)'),
    getProperty: koffi.proto('long EdgeFxGetProperty(void *self, uint32_t index, void *out)'),
    getSource: koffi.proto('long EdgeFxGetSource(void *self, uint32_t index, void *out)'),
    sourceCount: koffi.proto('long EdgeFxSourceCount(void *self, void *out)'),
    getIids: koffi.proto('long EdgeFxGetIids(void *self, void *count, void *iids)'),
    trustLevel: koffi.proto('long EdgeFxTrustLevel(void *self, void *out)'),
    getName: koffi.proto('long EdgeFxGetName(void *self, void *out)'),
    putName: koffi.proto('long EdgeFxPutName(void *self, void *value)'),
    release: koffi.proto('uint32_t EdgeFxRelease(void *self)')
  }

  return {
    combase,
    coremessaging,
    ole32,
    user32,
    proto,
    fn: {
      WindowsCreateString: combase.func(
        'long WindowsCreateString(const uint16_t *source, uint32_t length, _Out_ EdgeDropOut *out)'
      ),
      WindowsDeleteString: combase.func('long WindowsDeleteString(void *hstring)'),
      WindowsGetStringRawBuffer: combase.func(
        'const uint16_t *WindowsGetStringRawBuffer(void *hstring, _Out_ uint32_t *length)'
      ),
      RoInitialize: combase.func('long RoInitialize(int initType)'),
      RoActivateInstance: combase.func(
        'long RoActivateInstance(void *cls, _Out_ EdgeDropOut *out)'
      ),
      RoGetActivationFactory: combase.func(
        'long RoGetActivationFactory(void *cls, uint8_t *iid, _Out_ EdgeDropOut *out)'
      ),
      CreateDispatcherQueueController: coremessaging.func(
        'long CreateDispatcherQueueController(EdgeDropDQOptions options, _Out_ EdgeDropOut *out)'
      ),
      CoTaskMemAlloc: ole32.func('void *CoTaskMemAlloc(size_t cb)'),
      CreateWindowExW: user32.func(
        'uintptr_t CreateWindowExW(uint32_t exStyle, str16 className, str16 windowName, uint32_t style, int x, int y, int cx, int cy, uintptr_t parent, uintptr_t menu, uintptr_t instance, void *param)'
      ),
      DestroyWindow: user32.func('bool DestroyWindow(uintptr_t hwnd)'),
      ShowWindow: user32.func('bool ShowWindow(uintptr_t hwnd, int cmd)'),
      SetWindowPos: user32.func(
        'bool SetWindowPos(uintptr_t hwnd, uintptr_t after, int x, int y, int cx, int cy, uint32_t flags)'
      )
    }
  }
}

function api(): NonNullable<typeof bindings> {
  if (bindings) return bindings
  if (bindingsError) throw new Error(bindingsError)
  try {
    bindings = loadBindings()
    return bindings
  } catch (err) {
    bindingsError = err instanceof Error ? err.message : String(err)
    throw err
  }
}

// ────────────────────────────────────────────────────────────── COM helpers
function hresult(code: number, what: string): number {
  if (code < 0) {
    throw new Error(`${what} failed: 0x${(code >>> 0).toString(16).padStart(8, '0')}`)
  }
  return code
}

const outBox = (): OutBox => ({ value: null })
const asPtr = (value: unknown) =>
  typeof value === 'number' ? BigInt(value) : (value as bigint | object)

function wrap(ptr: unknown): Wrapped {
  if (!ptr) throw new Error('null interface pointer')
  const vptr = koffi.decode(ptr as never, 'void *')
  return { ptr, slots: koffi.decode(vptr as never, koffi.array('void *', VTABLE_SLOTS)) as unknown[] }
}

/** Call an interface method by its interface-relative index (after IInspectable). */
function method(o: Wrapped, index: number, proto: unknown, ...args: unknown[]): number {
  return koffi.call(o.slots[INSPECTABLE_SLOTS + index] as never, proto as never, o.ptr as never, ...args) as number
}

function inspectable(o: Wrapped, absoluteIndex: number, proto: unknown, ...args: unknown[]): number {
  return koffi.call(o.slots[absoluteIndex] as never, proto as never, o.ptr as never, ...args) as number
}

function queryInterface(target: Wrapped | unknown, iid: Buffer): Wrapped {
  const o = (target as Wrapped)?.slots ? (target as Wrapped) : wrap(target)
  const box = outBox()
  hresult(inspectable(o, 0, api().proto.qi, iid, box), 'QueryInterface')
  return wrap(box.value)
}

function runtimeClassName(o: Wrapped): string {
  const box = outBox()
  hresult(inspectable(o, 4, api().proto.className, box), 'GetRuntimeClassName')
  const len = [0] as unknown as number[]
  const chars = api().fn.WindowsGetStringRawBuffer(box.value as never, len as never)
  const text = chars
    ? String.fromCharCode(...(koffi.decode(chars as never, koffi.array('uint16_t', len[0])) as number[]))
    : ''
  api().fn.WindowsDeleteString(box.value as never)
  return text
}

function hstring(text: string): unknown {
  const buf = Buffer.from(text, 'utf16le')
  const box = outBox()
  hresult(api().fn.WindowsCreateString(buf as never, text.length, box), 'WindowsCreateString')
  return box.value
}

function addRef(target: Wrapped | unknown): number {
  const o = (target as Wrapped)?.slots ? (target as Wrapped) : wrap(target)
  return koffi.call(o.slots[1] as never, api().proto.addRef as never, o.ptr as never) as number
}

function verify(ptr: unknown, expected?: string): Wrapped {
  const o = wrap(ptr)
  o.className = runtimeClassName(o)
  if (expected && o.className !== expected) {
    throw new Error(`unexpected runtime class "${o.className}", expected "${expected}"`)
  }
  return o
}

// ─────────────────────────────────────── the Gaussian blur effect object
interface EffectState {
  sigma: number
  sourceParameter: unknown
  refs: number
  effectFace: unknown
  interopFace: unknown
}

const keepAlive: unknown[] = []

function encodePtr(address: unknown, value: unknown): void {
  koffi.encode(address as never, 'void *', asPtr(value) as never)
}
function encodeU32(address: unknown, value: number): void {
  koffi.encode(address as never, 'uint32_t', value as never)
}
function encodeBytes(address: unknown, bytes: Buffer): void {
  koffi.encode(address as never, 'uint8_t', Array.from(bytes) as never, bytes.length as never)
}
function decodeGuid(address: unknown): number[] {
  return Array.from(koffi.decode(address as never, koffi.array('uint8_t', 16)) as Uint8Array)
}
function decodeWide(address: unknown, maxChars = 64): string {
  const chars = koffi.decode(address as never, koffi.array('uint16_t', maxChars)) as number[]
  let text = ''
  for (const code of chars) {
    if (code === 0) break
    text += String.fromCharCode(code)
  }
  return text
}
const sameGuid = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i])
const plausible = (address: unknown): boolean => {
  const value = typeof address === 'bigint' ? address : BigInt((address as number) || 0)
  return value > 0x1000n && value < 0x800000000000n
}

function registerFace(
  protos: unknown[],
  handlers: ((...args: unknown[]) => number)[]
): unknown {
  const pointers = protos.map((proto, index) =>
    koffi.register(
      ((...args: unknown[]) => {
        try {
          return handlers[index](...args)
        } catch {
          return E_FAIL // never let a JS exception unwind into COM
        }
      }) as never,
      koffi.pointer(proto as never) as never
    )
  )
  keepAlive.push(...pointers)
  const vtable = koffi.alloc('uint8_t', 8 * protos.length)
  pointers.forEach((pointer, index) => koffi.encode(vtable, 8 * index, 'void *', pointer as never))
  const instance = koffi.alloc('uint8_t', 8)
  encodePtr(instance, vtable)
  keepAlive.push(vtable, instance)
  return instance
}

function propertyValue(which: 'single' | 'uint32', value: number): unknown {
  const statics = (propertyValueStatics ??= roGetActivationFactory(
    'Windows.Foundation.PropertyValue',
    IID.IPropertyValueStatics
  ))
  const box = outBox()
  if (which === 'single') {
    hresult(method(statics, 8, api().proto.createSingle, value, box), 'PropertyValue.CreateSingle')
  } else {
    hresult(method(statics, 5, api().proto.createU32, value, box), 'PropertyValue.CreateUInt32')
  }
  return box.value
}
let propertyValueStatics: Wrapped | null = null
let effectParameterFactory: Wrapped | null = null

function roGetActivationFactory(className: string, iid: Buffer): Wrapped {
  const cls = hstring(className)
  const box = outBox()
  try {
    hresult(
      api().fn.RoGetActivationFactory(cls as never, iid as never, box),
      `RoGetActivationFactory(${className})`
    )
  } finally {
    api().fn.WindowsDeleteString(cls as never)
  }
  return wrap(box.value)
}

function createEffectSourceParameter(name: string): Wrapped {
  effectParameterFactory ??= roGetActivationFactory(
    'Windows.UI.Composition.CompositionEffectSourceParameter',
    IID.ICompositionEffectSourceParameterFactory
  )
  const text = hstring(name)
  const box = outBox()
  try {
    hresult(
      method(effectParameterFactory, 0, api().proto.createParam, text, box),
      'CreateEffectSourceParameter'
    )
  } finally {
    api().fn.WindowsDeleteString(text as never)
  }
  return wrap(box.value)
}

/** Build the effect object whose only job is to describe CLSID_D2D1GaussianBlur. */
function createBlurEffect(sigma: number, sourceParameter: unknown): EffectState {
  const state: EffectState = {
    sigma,
    sourceParameter,
    refs: 1,
    effectFace: null,
    interopFace: null
  }
  const proto = api().proto

  const qi = (_self: unknown, iid: unknown, out: unknown): number => {
    const requested = decodeGuid(iid)
    const wantsInterop = sameGuid(requested, Array.from(IID.IGraphicsEffectD2D1Interop))
    const wantsEffect =
      sameGuid(requested, Array.from(IID.IUnknown)) ||
      sameGuid(requested, Array.from(IID.IInspectable)) ||
      sameGuid(requested, Array.from(IID.IGraphicsEffect)) ||
      sameGuid(requested, Array.from(IID.IGraphicsEffectSource))
    if (!wantsInterop && !wantsEffect) return E_NOINTERFACE
    encodePtr(out, wantsInterop ? state.interopFace : state.effectFace)
    state.refs++
    return S_OK
  }
  const addref = (): number => ++state.refs
  const release = (): number => (--state.refs > 0 ? state.refs : 0)
  const getIids = (_self: unknown, count: unknown, iids: unknown): number => {
    if (!plausible(count) || !plausible(iids)) return E_INVALIDARG
    const memory = api().fn.CoTaskMemAlloc(16)
    encodeBytes(memory, IID.IGraphicsEffectD2D1Interop)
    encodeU32(count, 1)
    encodePtr(iids, memory)
    return S_OK
  }
  const className = (_self: unknown, out: unknown): number => {
    encodePtr(out, null)
    return S_OK
  }
  const trustLevel = (_self: unknown, out: unknown): number => {
    if (!plausible(out)) return E_INVALIDARG
    encodeU32(out, 0)
    return S_OK
  }
  const getName = (_self: unknown, out: unknown): number => {
    encodePtr(out, null)
    return S_OK
  }
  const putName = (): number => S_OK
  const effectId = (_self: unknown, out: unknown): number => {
    if (!plausible(out)) return E_INVALIDARG
    encodeBytes(out, CLSID_D2D1_GAUSSIAN_BLUR)
    return S_OK
  }
  const namedMapping = (_self: unknown, name: unknown, index: unknown, mapping: unknown): number => {
    const text = decodeWide(name)
    const map: Record<string, number> = { BlurAmount: 0, Optimization: 1, BorderMode: 2 }
    if (!(text in map)) return E_INVALIDARG
    encodeU32(index, map[text])
    encodeU32(mapping, 0) // GRAPHICS_EFFECT_PROPERTY_MAPPING_DIRECT
    return S_OK
  }
  const propCount = (_self: unknown, out: unknown): number => {
    if (!plausible(out)) return E_INVALIDARG
    encodeU32(out, 3)
    return S_OK
  }
  const getProperty = (_self: unknown, index: unknown, out: unknown): number => {
    const slot = Number(index)
    let value: unknown = null
    if (slot === 0) value = propertyValue('single', state.sigma)
    else if (slot === 1) value = propertyValue('uint32', 1) // BALANCED
    else if (slot === 2) value = propertyValue('uint32', 1) // BORDER_MODE_SOFT
    if (!value) return E_BOUNDS
    encodePtr(out, value)
    return S_OK
  }
  const getSource = (_self: unknown, index: unknown, out: unknown): number => {
    if (Number(index) !== 0) return E_BOUNDS
    encodePtr(out, state.sourceParameter)
    addRef(state.sourceParameter)
    return S_OK
  }
  const sourceCount = (_self: unknown, out: unknown): number => {
    if (!plausible(out)) return E_INVALIDARG
    encodeU32(out, 1)
    return S_OK
  }

  // IGraphicsEffect derives from IInspectable, IGraphicsEffectD2D1Interop from
  // IUnknown -- hence the different number of leading slots in each face.
  state.effectFace = registerFace(
    [proto.qi, proto.addRef, proto.release, proto.getIids, proto.className, proto.trustLevel, proto.getName, proto.putName],
    [qi, addref, release, getIids, className, trustLevel, getName, putName]
  )
  state.interopFace = registerFace(
    [proto.qi, proto.addRef, proto.release, proto.effectId, proto.namedMapping, proto.propCount, proto.getProperty, proto.getSource, proto.sourceCount],
    [qi, addref, release, effectId, namedMapping, propCount, getProperty, getSource, sourceCount]
  )
  keepAlive.push(state)
  return state
}

// ─────────────────────────────────────────────────────────── Compositor
class Compositor {
  readonly name: string
  private readonly compositor: Wrapped
  private readonly i1: Wrapped
  private readonly i2: Wrapped
  private readonly i7: Wrapped
  private readonly desktop: Wrapped

  constructor() {
    ensureDispatcherQueue()
    const init = api().fn.RoInitialize(0)
    if (init < 0 && init !== -2147417850) {
      throw new Error(`RoInitialize failed: 0x${(init >>> 0).toString(16)}`)
    }
    const cls = hstring('Windows.UI.Composition.Compositor')
    const box = outBox()
    try {
      hresult(api().fn.RoActivateInstance(cls as never, box), 'RoActivateInstance(Compositor)')
    } finally {
      api().fn.WindowsDeleteString(cls as never)
    }
    this.compositor = verify(box.value, 'Windows.UI.Composition.Compositor')
    this.name = this.compositor.className ?? ''
    this.i1 = queryInterface(this.compositor, IID.ICompositor)
    this.i2 = queryInterface(this.compositor, IID.ICompositor2)
    this.i7 = queryInterface(this.compositor, IID.ICompositor7)
    this.desktop = queryInterface(this.compositor, IID.ICompositorDesktopInterop)
  }

  createContainer(): Wrapped {
    const box = outBox()
    hresult(method(this.i1, 3, api().proto.create, box), 'CreateContainerVisual')
    return verify(box.value, 'Windows.UI.Composition.ContainerVisual')
  }

  createSprite(): Wrapped {
    const box = outBox()
    hresult(method(this.i1, 16, api().proto.create, box), 'CreateSpriteVisual')
    return verify(box.value, 'Windows.UI.Composition.SpriteVisual')
  }

  createBackdropBrush(): Wrapped {
    const box = outBox()
    hresult(method(this.i2, 2, api().proto.create, box), 'CreateBackdropBrush')
    return verify(box.value, 'Windows.UI.Composition.CompositionBackdropBrush')
  }

  createRectangleClip(): Wrapped {
    const box = outBox()
    hresult(method(this.i7, 2, api().proto.create, box), 'CreateRectangleClip')
    return verify(box.value, 'Windows.UI.Composition.RectangleClip')
  }

  /** Slot 5 is `(effect, out)`; slot 6 also takes the animatable properties. */
  createEffectFactory(effectFace: unknown): Wrapped {
    const box = outBox()
    let hr = method(this.i1, 5, api().proto.createFactory, effectFace, box)
    if (hr < 0) {
      box.value = null
      hr = method(this.i1, 6, api().proto.createFactoryWithProps, effectFace, null, box)
    }
    hresult(hr, 'CreateEffectFactory')
    return verify(box.value, 'Windows.UI.Composition.CompositionEffectFactory')
  }

  /** Backdrop -> GaussianBlur, bound to the desktop behind the window. */
  createBlurBrush(sigma: number): Wrapped {
    const backdrop = this.createBackdropBrush()
    const parameter = createEffectSourceParameter('backdrop')
    const effect = createBlurEffect(sigma, parameter.ptr)
    const factory = this.createEffectFactory(effect.effectFace)
    const box = outBox()
    hresult(method(factory, 0, api().proto.create, box), 'CreateBrush')
    const brush = verify(box.value, 'Windows.UI.Composition.CompositionEffectBrush')
    const text = hstring('backdrop')
    try {
      const bound = queryInterface(backdrop, IID.ICompositionBrush)
      hresult(method(brush, 1, api().proto.putObj2, text, bound.ptr), 'SetSourceParameter')
    } finally {
      api().fn.WindowsDeleteString(text as never)
    }
    return brush
  }

  createDesktopWindowTarget(hwnd: number, topmost: boolean): Wrapped {
    const box = outBox()
    // ICompositorDesktopInterop is IUnknown-based: CreateDesktopWindowTarget is
    // its first method, i.e. absolute slot 3.
    const hr = koffi.call(
      this.desktop.slots[3] as never,
      api().proto.createTarget as never,
      this.desktop.ptr as never,
      hwnd as never,
      (topmost ? 1 : 0) as never,
      box as never
    ) as number
    hresult(hr, 'CreateDesktopWindowTarget')
    return verify(box.value)
  }
}

let dispatcherQueue: unknown = null
function ensureDispatcherQueue(): void {
  if (dispatcherQueue) return
  const box = outBox()
  const hr = api().fn.CreateDispatcherQueueController(
    // threadType 2 = DQTYPE_THREAD_CURRENT (1 would build the queue on a new
    // thread, leaving this one without one and the compositor refused).
    { dwSize: 12, threadType: 2, apartmentType: 2 },
    box
  )
  if (hr < 0 || !box.value) {
    throw new Error(
      `CreateDispatcherQueueController failed: 0x${(hr >>> 0).toString(16).padStart(8, '0')}`
    )
  }
  dispatcherQueue = box.value
}

// ─────────────────────────────────────────────────────── visual helpers
function asVisual(o: Wrapped): Wrapped {
  return queryInterface(o, IID.IVisual)
}
function childrenOf(container: Wrapped): Wrapped {
  const cv = queryInterface(container, IID.IContainerVisual)
  const box = outBox()
  hresult(method(cv, 0, api().proto.getObj, box), 'get_Children')
  return queryInterface(wrap(box.value), IID.IVisualCollection)
}
function insertAtTop(collection: Wrapped, visual: Wrapped): void {
  hresult(method(collection, 3, api().proto.putObj, visual.ptr), 'InsertAtTop')
}
function setSpriteBrush(sprite: Wrapped, brush: Wrapped): void {
  const sv = queryInterface(sprite, IID.ISpriteVisual)
  const b = queryInterface(brush, IID.ICompositionBrush)
  hresult(method(sv, 1, api().proto.putObj, b.ptr), 'put_Brush')
}
function setRoot(target: Wrapped, visual: Wrapped): void {
  const t = queryInterface(target, IID.ICompositionTarget)
  const v = queryInterface(visual, IID.IVisual)
  hresult(method(t, 1, api().proto.putObj, v.ptr), 'put_Root')
}
function setSize(visual: Wrapped, width: number, height: number): void {
  hresult(method(visual, 30, api().proto.putV2, { x: width, y: height }), 'put_Size')
}
function setOffset(visual: Wrapped, x: number, y: number): void {
  hresult(method(visual, 15, api().proto.putV3, { x, y, z: 0 }), 'put_Offset')
}
function setClip(visual: Wrapped, clip: Wrapped): void {
  hresult(method(visual, 9, api().proto.putObj, clip.ptr), 'put_Clip')
}
function setVisible(visual: Wrapped, visible: boolean): void {
  hresult(method(visual, 13, api().proto.putBool, visible ? 1 : 0), 'put_IsVisible')
}

function applyClip(
  clip: Wrapped,
  width: number,
  height: number,
  radii: CornerRadii
): void {
  const rc = queryInterface(clip, IID.IRectangleClip)
  // RectangleClip is absolute, not inset: Right/Bottom must be the size.
  hresult(method(rc, 7, api().proto.putFloat, 0), 'put_Left')
  hresult(method(rc, 11, api().proto.putFloat, 0), 'put_Top')
  hresult(method(rc, 9, api().proto.putFloat, width), 'put_Right')
  hresult(method(rc, 1, api().proto.putFloat, height), 'put_Bottom')
  hresult(method(rc, 13, api().proto.putV2, { x: radii.topLeft, y: radii.topLeft }), 'put_TopLeftRadius')
  hresult(method(rc, 15, api().proto.putV2, { x: radii.topRight, y: radii.topRight }), 'put_TopRightRadius')
  hresult(method(rc, 5, api().proto.putV2, { x: radii.bottomRight, y: radii.bottomRight }), 'put_BottomRightRadius')
  hresult(method(rc, 3, api().proto.putV2, { x: radii.bottomLeft, y: radii.bottomLeft }), 'put_BottomLeftRadius')
}

// ───────────────────────────────────────────────────────────── the layer
/**
 * One compositor-owned overlay window that covers the panel and draws a
 * rounded, blurred copy of the desktop exactly where the blade is.
 */
export class GlassLayer {
  private compositor: Compositor | null = null
  private hwnd = 0
  private target: Wrapped | null = null
  private sprite: Wrapped | null = null
  private clip: Wrapped | null = null
  private spriteVisual: Wrapped | null = null
  private brush: Wrapped | null = null
  private rect: GlassRect | null = null
  private radii: CornerRadii = ZERO_RADII
  private sigma = 24
  private visible = false
  private panel: BrowserWindow | null = null
  private scale = 1
  private onVisibility: ((visible: boolean) => void) | null = null

  isReady(): boolean {
    return !!this.target && !!this.sprite
  }

  setVisibilityListener(cb: (visible: boolean) => void): void {
    this.onVisibility = cb
  }

  /** Create the overlay window and its visual tree (idempotent). */
  create(panel: BrowserWindow | null): boolean {
    if (this.hwnd) {
      if (panel) this.panel = panel
      return true
    }
    if (panel) this.panel = panel
    try {
      this.compositor = new Compositor()
      this.hwnd = this.createWindow()
      this.target = this.compositor.createDesktopWindowTarget(this.hwnd, true)
      const root = this.compositor.createContainer()
      this.sprite = this.compositor.createSprite()
      this.spriteVisual = asVisual(this.sprite)
      this.clip = this.compositor.createRectangleClip()
      this.brush = this.compositor.createBlurBrush(this.sigma)
      setSpriteBrush(this.sprite, this.brush)
      setClip(this.spriteVisual, this.clip)
      insertAtTop(childrenOf(root), this.sprite)
      setRoot(this.target, root)
      this.layout()
      this.applyVisibility()
      return true
    } catch (err) {
      console.warn('[Glass] composition layer unavailable:', err)
      this.destroy()
      return false
    }
  }

  private createWindow(): number {
    const bounds = this.currentPanelBounds()
    const exStyle =
      WS_EX_NOREDIRECTIONBITMAP | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_TOPMOST
    const hwnd = api().fn.CreateWindowExW(
      exStyle,
      'STATIC',
      '',
      WS_POPUP | WS_VISIBLE,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      0,
      null
    )
    if (!hwnd) throw new Error('CreateWindowExW failed')
    api().fn.ShowWindow(hwnd, SW_SHOWNOACTIVATE)
    return hwnd
  }

  private currentPanelBounds(): { x: number; y: number; width: number; height: number } {
    const panel = this.panel && !this.panel.isDestroyed() ? this.panel : null
    if (!panel) return { x: 0, y: 0, width: 8, height: 8 }
    this.scale = screen.getDisplayMatching(panel.getBounds()).scaleFactor || 1
    const b = panel.getBounds()
    return { x: b.x, y: b.y, width: Math.max(8, b.width), height: Math.max(8, b.height) }
  }

  /** Keep the overlay exactly on top of the panel's client area. */
  moveToPanel(): void {
    if (!this.hwnd) return
    const bounds = this.currentPanelBounds()
    const scale = this.scale
    api().fn.SetWindowPos(
      this.hwnd,
      0,
      Math.round(bounds.x * scale),
      Math.round(bounds.y * scale),
      Math.round(bounds.width * scale),
      Math.round(bounds.height * scale),
      SWP_NOACTIVATE | SWP_NOOWNERZORDER
    )
    this.layout()
  }

  /** Put the glass directly under the panel window, never above it. */
  raise(isVisible: boolean): void {
    if (!this.hwnd) return
    const panelHwnd = this.panelHwnd()
    api().fn.SetWindowPos(
      this.hwnd,
      panelHwnd,
      0,
      0,
      0,
      0,
      SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER
    )
    this.setVisible(isVisible)
  }

  /**
   * Re-insert the glass under the panel without touching its visibility.
   *
   * Activating the panel (the hotkey recorder and the search field make the
   * window focusable for a moment) can leave the deactivated panel *below*
   * this topmost overlay, which then paints the blur on top of the cards: the
   * "everything went blurry until I show the desktop" report. One SetWindowPos
   * puts it back. Cheap enough to be called on every focus transition.
   */
  reassertOrder(): void {
    if (!this.hwnd || !this.visible) return
    const panelHwnd = this.panelHwnd()
    if (!panelHwnd) return
    api().fn.SetWindowPos(
      this.hwnd,
      panelHwnd,
      0,
      0,
      0,
      0,
      SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER
    )
  }

  private panelHwnd(): number {
    const panel = this.panel
    if (!panel || panel.isDestroyed()) return 0
    const buf = panel.getNativeWindowHandle()
    return Number(process.arch === 'x64' ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0)))
  }

  setRect(rect: GlassRect | null): void {
    this.rect = rect
    this.layout()
  }

  setRadii(radii: CornerRadii): void {
    this.radii = radii
    this.layout()
  }

  /** Blur strength, in logical pixels (the effect graph ignores DPI). */
  setBlur(sigma: number): void {
    const next = Math.max(0, sigma)
    if (Math.abs(next - this.sigma) < 0.5 || !this.compositor) {
      this.sigma = next
      return
    }
    this.sigma = next
    try {
      const brush = this.compositor.createBlurBrush(next)
      if (this.sprite) setSpriteBrush(this.sprite, brush)
      this.brush = brush
    } catch (err) {
      console.warn('[Glass] failed to change blur strength:', err)
    }
  }

  private layout(): void {
    if (!this.spriteVisual || !this.clip) return
    const rect = this.rect
    if (!rect || rect.width < 2 || rect.height < 2) {
      setVisible(this.spriteVisual, false)
      return
    }
    const s = this.scale || 1
    const width = Math.max(2, Math.round(rect.width * s))
    const height = Math.max(2, Math.round(rect.height * s))
    setOffset(this.spriteVisual, Math.round(rect.left * s), Math.round(rect.top * s))
    setSize(this.spriteVisual, width, height)
    const r: CornerRadii = {
      topLeft: Math.round(this.radii.topLeft * s),
      topRight: Math.round(this.radii.topRight * s),
      bottomRight: Math.round(this.radii.bottomRight * s),
      bottomLeft: Math.round(this.radii.bottomLeft * s)
    }
    applyClip(this.clip, width, height, r)
    setVisible(this.spriteVisual, this.visible)
  }

  setVisible(next: boolean): void {
    if (this.visible === next) {
      this.applyVisibility()
      return
    }
    this.visible = next
    this.applyVisibility()
    this.onVisibility?.(next)
  }

  private applyVisibility(): void {
    if (this.spriteVisual) {
      const hasShape = !!this.rect && this.rect.width >= 2 && this.rect.height >= 2
      setVisible(this.spriteVisual, this.visible && hasShape)
    }
    if (!this.hwnd) return
    api().fn.ShowWindow(this.hwnd, this.visible ? SW_SHOWNOACTIVATE : 0)
  }

  isVisible(): boolean {
    return this.visible && this.isReady()
  }

  destroy(): void {
    this.visible = false
    this.rect = null
    this.target = null
    this.sprite = null
    this.spriteVisual = null
    this.clip = null
    this.brush = null
    this.compositor = null
    if (this.hwnd) {
      api().fn.DestroyWindow(this.hwnd)
      this.hwnd = 0
    }
  }
}


