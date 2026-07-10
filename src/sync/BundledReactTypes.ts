// A self-contained, workspace-local type surface for React and ReactDOM.
//
// Why this exists: earlier versions of the extension bundled the full
// `@types/react` / `@types/react-dom` packages under `dist/types/` and wrote
// absolute paths into the user's tsconfig pointing at that directory. VS Code
// installs extensions under a versioned folder (e.g.
// `.vscode/extensions/…bitburner-file-sync-plugin-0.1.2/…`), so every extension
// upgrade left every user with a stale, dangling path and broke all React
// IntelliSense until they re-ran `Download Type Definitions`.
//
// The fix: ship a curated but useful subset of the React public API right
// inside the generated `NetscriptGlobals.d.ts`. The file lives in the
// workspace, tracked by the user, so it survives extension upgrades — and
// because it's ambient module + global namespace declarations, `import { NS }
// from "@ns"` (which internally references `import { ReactNode } from
// "react"`) resolves without any tsconfig paths pointing at extension
// internals. `React` and `ReactDOM` are also declared as global namespaces
// so scripts using the Bitburner runtime globals get the same types.
//
// Scope: covers what Bitburner scripts actually reach for — hooks, function
// and class components, element factories, refs, memo/lazy/forwardRef, the
// event object hierarchy, `HTMLAttributes` / `DetailedHTMLProps` / common
// tag-specific attribute bags, `CSSProperties` (typed loosely — a full
// csstype clone is 22k lines and not worth the file bloat), and a JSX
// namespace mapping every intrinsic tag we care about. Advanced React
// internals (concurrent scheduler tracing, prop-types validators, the full
// SVG element roster, etc.) are intentionally omitted. Anyone hitting the
// limits can install `@types/react` locally and let module augmentation
// override us.

// The React / ReactDOM / JSX namespaces. Designed to be wrapped in
// `declare global { … }` by the shim renderer — inside a module file (which
// NetscriptGlobals.d.ts is, thanks to its `import` and `export {}`), an
// unwrapped `declare namespace React` would create a *module-local* React
// rather than the global the Bitburner runtime exposes.
export const BUNDLED_REACT_NAMESPACES = `    namespace React {
        // --------------------------------------------------------------
        // Core primitives
        // --------------------------------------------------------------

        type Key = string | number;

        interface RefObject<T> {
            readonly current: T | null;
        }

        interface MutableRefObject<T> {
            current: T;
        }

        type RefCallback<T> = (instance: T | null) => void;
        type Ref<T> = RefCallback<T> | RefObject<T> | null;
        type LegacyRef<T> = string | Ref<T>;

        type ComponentState = any;

        interface Attributes {
            key?: Key | null | undefined;
        }
        interface ClassAttributes<T> extends Attributes {
            ref?: LegacyRef<T> | undefined;
        }

        // --------------------------------------------------------------
        // Elements and nodes
        // --------------------------------------------------------------

        interface ReactElement<
            P = any,
            T extends string | JSXElementConstructor<any> =
                | string
                | JSXElementConstructor<any>,
        > {
            type: T;
            props: P;
            key: Key | null;
        }

        type JSXElementConstructor<P> =
            | ((props: P) => ReactElement<any, any> | null)
            | (new (props: P) => Component<P, any>);

        type ReactText = string | number;
        type ReactChild = ReactElement | ReactText;
        interface ReactNodeArray extends ReadonlyArray<ReactNode> {}
        type ReactFragment = Iterable<ReactNode>;
        type ReactNode =
            | ReactChild
            | ReactFragment
            | ReactPortal
            | boolean
            | null
            | undefined;

        interface ReactPortal extends ReactElement {
            key: Key | null;
            children: ReactNode;
        }

        // --------------------------------------------------------------
        // Components
        // --------------------------------------------------------------

        type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;

        interface FunctionComponent<P = {}> {
            (props: PropsWithChildren<P>, context?: any): ReactElement<any, any> | null;
            displayName?: string | undefined;
            defaultProps?: Partial<P> | undefined;
        }
        type FC<P = {}> = FunctionComponent<P>;

        interface ComponentClass<P = {}, S = ComponentState> {
            new (props: P, context?: any): Component<P, S>;
            displayName?: string | undefined;
            defaultProps?: Partial<P> | undefined;
            contextType?: Context<any> | undefined;
        }

        type PropsWithChildren<P = unknown> = P & { children?: ReactNode | undefined };
        type PropsWithRef<P> = P;
        type PropsWithoutRef<P> = Pick<P, Exclude<keyof P, "ref">>;

        /**
         * Base class for class-based React components with local state and
         * lifecycle methods. Subclass and implement \`render()\` to return the
         * component's UI, then update \`state\` via \`setState()\`.
         *
         * @example
         *     class Counter extends React.Component<{}, { n: number }> {
         *         state = { n: 0 };
         *         render() {
         *             return React.createElement("button",
         *                 { onClick: () => this.setState({ n: this.state.n + 1 }) },
         *                 \`Count: \${this.state.n}\`);
         *         }
         *     }
         *
         * For most cases prefer function components with hooks — they're
         * shorter, easier to reason about, and the recommended default.
         *
         * @see https://react.dev/reference/react/Component
         */
        class Component<P = {}, S = {}> {
            constructor(props: Readonly<P> | P);
            constructor(props: P, context: any);
            /**
             * Schedule an update to the component's local state. React
             * merges the returned partial into the current state and
             * re-renders. State updates are asynchronous and may be
             * batched — never mutate \`this.state\` directly.
             *
             * Pass a function \`(prev, props) => next\` when the next state
             * depends on the current state to avoid stale-read bugs.
             */
            setState<K extends keyof S>(
                state:
                    | ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null)
                    | (Pick<S, K> | S | null),
                callback?: () => void,
            ): void;
            /**
             * Skip \`shouldComponentUpdate\` and force a re-render. Almost
             * always the wrong tool — prefer \`setState\` and let React decide.
             */
            forceUpdate(callback?: () => void): void;
            render(): ReactNode;
            readonly props: Readonly<P> & Readonly<{ children?: ReactNode | undefined }>;
            state: Readonly<S>;
            context: any;
            refs: { [key: string]: any };
        }
        /**
         * Like \`Component\`, but with a shallow-equal \`shouldComponentUpdate\`
         * baked in — skips re-renders when both props and state are shallowly
         * equal to the previous values. Useful for expensive renders where
         * parents re-render frequently but props rarely change.
         *
         * @see https://react.dev/reference/react/PureComponent
         */
        class PureComponent<P = {}, S = {}> extends Component<P, S> {}

        // --------------------------------------------------------------
        // Element factories
        // --------------------------------------------------------------

        /**
         * Group children without emitting a wrapper DOM node. Use when a
         * component needs to return multiple sibling elements but you don't
         * want an extra \`<div>\` in the tree. In JSX, the shorthand \`<>…</>\`
         * is equivalent to \`<React.Fragment>…</React.Fragment>\`.
         *
         * @see https://react.dev/reference/react/Fragment
         */
        const Fragment: JSXElementConstructor<{ children?: ReactNode }>;
        /**
         * Development-only wrapper that opts children into extra checks —
         * double-invokes render/effect bodies to surface impure code, warns
         * on deprecated APIs. No runtime effect in production builds.
         *
         * @see https://react.dev/reference/react/StrictMode
         */
        const StrictMode: JSXElementConstructor<{ children?: ReactNode }>;
        /**
         * Declaratively wait for something (usually \`React.lazy\` or a data
         * fetch) to load before rendering children, showing \`fallback\` in
         * the meantime.
         *
         * @example
         *     const Big = React.lazy(() => import("./Big"));
         *     <React.Suspense fallback={<div>loading…</div>}>
         *         <Big />
         *     </React.Suspense>
         *
         * @see https://react.dev/reference/react/Suspense
         */
        const Suspense: JSXElementConstructor<{ children?: ReactNode; fallback?: ReactNode }>;

        /**
         * Create a React element without JSX. \`type\` is either a string
         * (intrinsic HTML tag) or a component. In \`.tsx\` files, prefer
         * JSX syntax — this is the underlying primitive it desugars to.
         *
         * @example
         *     React.createElement("div", { className: "row" },
         *         React.createElement("span", null, "hi"))
         *     // equivalent JSX: <div className="row"><span>hi</span></div>
         *
         * @see https://react.dev/reference/react/createElement
         */
        function createElement<P extends {}>(
            type: string | JSXElementConstructor<P>,
            props?: (Attributes & P) | null,
            ...children: ReactNode[]
        ): ReactElement<P>;
        /**
         * Duplicate an existing element, optionally overriding props or
         * children. The original element is left untouched. Typically used
         * by higher-order components that want to inject extra props into
         * children they didn't create.
         *
         * @see https://react.dev/reference/react/cloneElement
         */
        function cloneElement<P>(
            element: ReactElement<P>,
            props?: Partial<P> & Attributes,
            ...children: ReactNode[]
        ): ReactElement<P>;
        /**
         * Type guard: true iff \`object\` is a React element created by
         * \`createElement\` or JSX. Useful when walking \`children\` prop
         * that may contain plain strings/numbers alongside elements.
         */
        function isValidElement<P>(object: {} | null | undefined): object is ReactElement<P>;
        /**
         * Create an empty ref object for use with class components'
         * \`ref\` prop. In function components, prefer \`useRef\` instead
         * (this exists mainly for legacy class code).
         */
        function createRef<T>(): RefObject<T>;

        // --------------------------------------------------------------
        // Context
        // --------------------------------------------------------------

        interface ProviderProps<T> {
            value: T;
            children?: ReactNode | undefined;
        }
        interface ConsumerProps<T> {
            children: (value: T) => ReactNode;
        }
        interface Provider<T> {
            (props: ProviderProps<T>): ReactElement<any, any> | null;
        }
        interface Consumer<T> {
            (props: ConsumerProps<T>): ReactElement<any, any> | null;
        }
        interface Context<T> {
            Provider: Provider<T>;
            Consumer: Consumer<T>;
            displayName?: string | undefined;
        }
        /**
         * Create a Context object for passing values through the tree
         * without threading props at every level. Wrap subtrees in
         * \`<Ctx.Provider value={…}>\` and read the current value with
         * \`useContext(Ctx)\` (or the class-based \`<Ctx.Consumer>\`).
         *
         * @example
         *     const Theme = React.createContext<"light" | "dark">("light");
         *     // Provide:
         *     <Theme.Provider value="dark"><App /></Theme.Provider>
         *     // Read:
         *     const theme = React.useContext(Theme);
         *
         * @see https://react.dev/reference/react/createContext
         */
        function createContext<T>(defaultValue: T): Context<T>;

        // --------------------------------------------------------------
        // Refs / memo / lazy / forwardRef
        // --------------------------------------------------------------

        interface ExoticComponent<P = {}> {
            (props: P): ReactElement | null;
            readonly $$typeof: symbol;
            displayName?: string | undefined;
        }
        interface MemoExoticComponent<T extends ComponentType<any>> extends ExoticComponent<any> {
            readonly type: T;
        }
        interface LazyExoticComponent<T extends ComponentType<any>> extends ExoticComponent<any> {
            readonly _result: T;
        }
        interface ForwardRefExoticComponent<P> extends ExoticComponent<P> {
            defaultProps?: Partial<P> | undefined;
        }

        /**
         * Let a function component receive a \`ref\` from its parent and
         * attach it to a DOM node or imperative handle it exposes. Refs
         * are otherwise not passed through function components.
         *
         * @example
         *     const Input = React.forwardRef<HTMLInputElement, { label: string }>(
         *         (props, ref) => React.createElement("input", { ref, "aria-label": props.label })
         *     );
         *
         * @see https://react.dev/reference/react/forwardRef
         */
        function forwardRef<T, P = {}>(
            render: (props: P, ref: Ref<T>) => ReactElement | null,
        ): ForwardRefExoticComponent<PropsWithoutRef<P> & { ref?: Ref<T> | undefined }>;

        /**
         * Wrap a component so React skips re-rendering it when its props
         * haven't shallowly changed. Use for expensive components inside
         * parents that re-render frequently. Optionally supply
         * \`propsAreEqual\` for custom comparison.
         *
         * @see https://react.dev/reference/react/memo
         */
        function memo<P extends object>(
            Component: FunctionComponent<P>,
            propsAreEqual?: (prev: Readonly<P>, next: Readonly<P>) => boolean,
        ): MemoExoticComponent<FunctionComponent<P>>;
        function memo<T extends ComponentType<any>>(
            Component: T,
            propsAreEqual?: (prev: any, next: any) => boolean,
        ): MemoExoticComponent<T>;

        /**
         * Declare a component that loads on demand. The factory is called
         * the first time the component renders, and the result is cached.
         * Must be rendered inside \`<React.Suspense>\` so React has a
         * fallback to show while loading.
         *
         * @example
         *     const Big = React.lazy(() => import("./Big"));
         *     <React.Suspense fallback={<Spinner />}><Big /></React.Suspense>
         *
         * @see https://react.dev/reference/react/lazy
         */
        function lazy<T extends ComponentType<any>>(
            factory: () => Promise<{ default: T }>,
        ): LazyExoticComponent<T>;

        // --------------------------------------------------------------
        // Hooks
        // --------------------------------------------------------------

        type SetStateAction<S> = S | ((prev: S) => S);
        type Dispatch<A> = (value: A) => void;
        type Reducer<S, A> = (prev: S, action: A) => S;
        type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
        type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;

        type EffectCallback = () => void | (() => void | undefined);
        type DependencyList = ReadonlyArray<unknown>;

        /**
         * Add a piece of local, mutable state to a function component.
         * Returns the current value and a setter that schedules a
         * re-render with the new value.
         *
         * If \`initial\` is a function it's called once, on mount — useful
         * for expensive initial values. The setter accepts either a new
         * value or an updater \`prev => next\` — prefer the updater form
         * when the next value depends on the previous one.
         *
         * @example
         *     const [count, setCount] = React.useState(0);
         *     // ...
         *     setCount(c => c + 1);  // safe under batching
         *
         * @see https://react.dev/reference/react/useState
         */
        function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
        function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];

        /**
         * Alternative to \`useState\` for complex state transitions. You
         * dispatch actions and a pure reducer computes the next state.
         * Useful when state updates involve multiple related values or
         * when the transition logic is worth extracting from the component.
         *
         * @example
         *     type Action = { kind: "inc" } | { kind: "reset" };
         *     const reducer = (n: number, a: Action) =>
         *         a.kind === "inc" ? n + 1 : 0;
         *     const [count, dispatch] = React.useReducer(reducer, 0);
         *     // dispatch({ kind: "inc" });
         *
         * @see https://react.dev/reference/react/useReducer
         */
        function useReducer<R extends Reducer<any, any>, I>(
            reducer: R,
            initializerArg: I,
            initializer: (arg: I) => ReducerState<R>,
        ): [ReducerState<R>, Dispatch<ReducerAction<R>>];
        function useReducer<R extends Reducer<any, any>>(
            reducer: R,
            initialState: ReducerState<R>,
            initializer?: undefined,
        ): [ReducerState<R>, Dispatch<ReducerAction<R>>];

        /**
         * Run a side effect after render commits — subscriptions, timers,
         * imperative DOM tweaks, network calls. Return a cleanup function
         * for anything that must be torn down (unsubscribe, clearInterval).
         *
         * \`deps\` controls when the effect re-runs:
         *   - \`undefined\`  → after every render
         *   - \`[]\`         → once, on mount (cleanup on unmount)
         *   - \`[a, b]\`     → whenever \`a\` or \`b\` changes (referential equality)
         *
         * @example
         *     React.useEffect(() => {
         *         const id = setInterval(tick, 1000);
         *         return () => clearInterval(id);
         *     }, []);
         *
         * @see https://react.dev/reference/react/useEffect
         */
        function useEffect(effect: EffectCallback, deps?: DependencyList): void;
        /**
         * Like \`useEffect\`, but fires synchronously after DOM mutations
         * and before the browser paints. Use only when you need to read
         * layout and re-render before the user sees the intermediate
         * state (e.g. measuring a node to position a tooltip). Blocks
         * paint, so keep the body cheap.
         *
         * @see https://react.dev/reference/react/useLayoutEffect
         */
        function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
        /**
         * Runs before any layout effect fires. Intended for CSS-in-JS
         * libraries to inject styles before children read layout. You
         * almost certainly want \`useEffect\` or \`useLayoutEffect\` instead.
         *
         * @see https://react.dev/reference/react/useInsertionEffect
         */
        function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;

        /**
         * Memoize an expensive computed value. \`factory\` re-runs only when
         * one of \`deps\` changes (by referential equality). Useful for
         * skipping heavy work on every render, or for stabilizing object
         * references passed to memoized children.
         *
         * Don't reach for this reflexively — the deps check has its own
         * cost. Measure before wrapping.
         *
         * @example
         *     const sorted = React.useMemo(() => [...items].sort(cmp), [items]);
         *
         * @see https://react.dev/reference/react/useMemo
         */
        function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T;
        /**
         * Return the same function reference across renders (as long as
         * \`deps\` don't change). Equivalent to \`useMemo(() => fn, deps)\`
         * for functions. Mostly useful when passing callbacks to memoized
         * children so their memoization actually holds.
         *
         * @example
         *     const onClick = React.useCallback(
         *         (e: React.MouseEvent) => selectItem(id),
         *         [id]
         *     );
         *
         * @see https://react.dev/reference/react/useCallback
         */
        function useCallback<T extends (...args: any[]) => any>(fn: T, deps: DependencyList): T;

        /**
         * Hold a mutable value across renders without triggering re-renders
         * when it changes. Two common uses:
         *
         *   - **DOM refs:** pass the returned object as JSX \`ref={…}\` and
         *     read \`ref.current\` in an effect to reach the DOM node.
         *   - **Instance-like storage:** stash any value you want to persist
         *     between renders but don't want in state.
         *
         * @example
         *     const inputRef = React.useRef<HTMLInputElement>(null);
         *     React.useEffect(() => { inputRef.current?.focus(); }, []);
         *
         * @see https://react.dev/reference/react/useRef
         */
        function useRef<T>(initialValue: T): MutableRefObject<T>;
        function useRef<T>(initialValue: T | null): RefObject<T>;
        function useRef<T = undefined>(): MutableRefObject<T | undefined>;

        /**
         * Read the current value of a Context inside a function component.
         * The component re-renders whenever the nearest matching Provider's
         * \`value\` changes.
         *
         * @example
         *     const theme = React.useContext(ThemeContext);
         *
         * @see https://react.dev/reference/react/useContext
         */
        function useContext<T>(context: Context<T>): T;
        /**
         * Attach a label to a custom hook for React DevTools. No effect
         * at runtime outside DevTools.
         */
        function useDebugValue<T>(value: T, format?: (value: T) => any): void;

        /**
         * Customize the value exposed via a forwarded ref. Rarely needed —
         * use only when a component must expose imperative methods (e.g.
         * \`.focus()\`, \`.scrollIntoView()\`) instead of a raw DOM node.
         *
         * @see https://react.dev/reference/react/useImperativeHandle
         */
        function useImperativeHandle<T, R extends T>(
            ref: Ref<T> | undefined,
            init: () => R,
            deps?: DependencyList,
        ): void;

        /**
         * Mark a state update as a non-urgent transition — React can
         * interrupt it if a more urgent update arrives. Returns
         * \`[isPending, startTransition]\`. Use for expensive re-renders
         * driven by fast-changing input (search-as-you-type, filtering
         * large lists) so the input itself stays responsive.
         *
         * @see https://react.dev/reference/react/useTransition
         */
        function useTransition(): [boolean, (callback: () => void) => void];
        /**
         * Return a "delayed" copy of a value: during urgent updates the
         * old value is preserved so expensive children don't have to
         * re-render right away. Complement to \`useTransition\` for values
         * you don't control the source of.
         *
         * @see https://react.dev/reference/react/useDeferredValue
         */
        function useDeferredValue<T>(value: T): T;
        /**
         * Generate a stable, unique ID string for the lifetime of the
         * component. Handy for pairing \`<label htmlFor>\` with input IDs
         * without hand-rolling counters.
         *
         * @see https://react.dev/reference/react/useId
         */
        function useId(): string;
        /**
         * Subscribe a component to an external store and re-render when
         * the store changes. Purpose-built for library authors integrating
         * non-React state (Redux-like stores, browser APIs). App code
         * usually reaches for \`useState\` / \`useReducer\` instead.
         *
         * @see https://react.dev/reference/react/useSyncExternalStore
         */
        function useSyncExternalStore<Snapshot>(
            subscribe: (onStoreChange: () => void) => () => void,
            getSnapshot: () => Snapshot,
            getServerSnapshot?: () => Snapshot,
        ): Snapshot;

        // --------------------------------------------------------------
        // CSS + events (typed permissively — full csstype/DOM detail is
        // out of scope for a self-contained shim)
        // --------------------------------------------------------------

        // Loose but useful: string values for anything, number values are
        // accepted for the numeric-shaped properties React itself allows.
        // Users who want strict per-property typing can install
        // @types/react in their workspace and let module augmentation
        // replace this.
        interface CSSProperties {
            [key: string]: string | number | null | undefined;
        }

        interface SyntheticEvent<T = Element, E = Event> {
            bubbles: boolean;
            cancelable: boolean;
            currentTarget: EventTarget & T;
            defaultPrevented: boolean;
            eventPhase: number;
            isTrusted: boolean;
            nativeEvent: E;
            preventDefault(): void;
            isDefaultPrevented(): boolean;
            stopPropagation(): void;
            isPropagationStopped(): boolean;
            persist(): void;
            target: EventTarget;
            timeStamp: number;
            type: string;
        }
        interface ClipboardEvent<T = Element> extends SyntheticEvent<T> {
            clipboardData: DataTransfer;
        }
        interface CompositionEvent<T = Element> extends SyntheticEvent<T> {
            data: string;
        }
        interface DragEvent<T = Element> extends MouseEvent<T> {
            dataTransfer: DataTransfer;
        }
        interface PointerEvent<T = Element> extends MouseEvent<T> {
            pointerId: number;
            pressure: number;
            pointerType: string;
            isPrimary: boolean;
        }
        interface FocusEvent<T = Element, R = Element> extends SyntheticEvent<T> {
            relatedTarget: (EventTarget & R) | null;
            target: EventTarget & T;
        }
        interface FormEvent<T = Element> extends SyntheticEvent<T> {}
        interface InvalidEvent<T = Element> extends SyntheticEvent<T> {
            target: EventTarget & T;
        }
        interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
            target: EventTarget & T;
        }
        interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
            altKey: boolean;
            charCode: number;
            ctrlKey: boolean;
            code: string;
            key: string;
            keyCode: number;
            locale: string;
            location: number;
            metaKey: boolean;
            repeat: boolean;
            shiftKey: boolean;
            which: number;
            getModifierState(key: string): boolean;
        }
        interface MouseEvent<T = Element, E = any> extends SyntheticEvent<T, E> {
            altKey: boolean;
            button: number;
            buttons: number;
            clientX: number;
            clientY: number;
            ctrlKey: boolean;
            metaKey: boolean;
            movementX: number;
            movementY: number;
            pageX: number;
            pageY: number;
            relatedTarget: EventTarget | null;
            screenX: number;
            screenY: number;
            shiftKey: boolean;
            getModifierState(key: string): boolean;
        }
        interface TouchEvent<T = Element> extends SyntheticEvent<T> {
            altKey: boolean;
            changedTouches: TouchList;
            ctrlKey: boolean;
            metaKey: boolean;
            shiftKey: boolean;
            targetTouches: TouchList;
            touches: TouchList;
            getModifierState(key: string): boolean;
        }
        interface UIEvent<T = Element> extends SyntheticEvent<T> {
            detail: number;
            view: any;
        }
        interface WheelEvent<T = Element> extends MouseEvent<T> {
            deltaMode: number;
            deltaX: number;
            deltaY: number;
            deltaZ: number;
        }
        interface AnimationEvent<T = Element> extends SyntheticEvent<T> {
            animationName: string;
            elapsedTime: number;
            pseudoElement: string;
        }
        interface TransitionEvent<T = Element> extends SyntheticEvent<T> {
            elapsedTime: number;
            propertyName: string;
            pseudoElement: string;
        }

        type EventHandler<E extends SyntheticEvent<any>> = (event: E) => void;
        type ReactEventHandler<T = Element> = EventHandler<SyntheticEvent<T>>;
        type ClipboardEventHandler<T = Element> = EventHandler<ClipboardEvent<T>>;
        type CompositionEventHandler<T = Element> = EventHandler<CompositionEvent<T>>;
        type DragEventHandler<T = Element> = EventHandler<DragEvent<T>>;
        type FocusEventHandler<T = Element> = EventHandler<FocusEvent<T>>;
        type FormEventHandler<T = Element> = EventHandler<FormEvent<T>>;
        type ChangeEventHandler<T = Element> = EventHandler<ChangeEvent<T>>;
        type KeyboardEventHandler<T = Element> = EventHandler<KeyboardEvent<T>>;
        type MouseEventHandler<T = Element> = EventHandler<MouseEvent<T>>;
        type TouchEventHandler<T = Element> = EventHandler<TouchEvent<T>>;
        type PointerEventHandler<T = Element> = EventHandler<PointerEvent<T>>;
        type UIEventHandler<T = Element> = EventHandler<UIEvent<T>>;
        type WheelEventHandler<T = Element> = EventHandler<WheelEvent<T>>;
        type AnimationEventHandler<T = Element> = EventHandler<AnimationEvent<T>>;
        type TransitionEventHandler<T = Element> = EventHandler<TransitionEvent<T>>;

        // --------------------------------------------------------------
        // HTML attribute bags
        // --------------------------------------------------------------

        interface AriaAttributes {
            [ariaKey: \`aria-\${string}\`]: string | number | boolean | undefined;
            role?: string | undefined;
        }

        interface DOMAttributes<T> {
            children?: ReactNode | undefined;
            dangerouslySetInnerHTML?: { __html: string } | undefined;

            onCopy?: ClipboardEventHandler<T> | undefined;
            onCut?: ClipboardEventHandler<T> | undefined;
            onPaste?: ClipboardEventHandler<T> | undefined;

            onCompositionEnd?: CompositionEventHandler<T> | undefined;
            onCompositionStart?: CompositionEventHandler<T> | undefined;
            onCompositionUpdate?: CompositionEventHandler<T> | undefined;

            onFocus?: FocusEventHandler<T> | undefined;
            onBlur?: FocusEventHandler<T> | undefined;

            onChange?: FormEventHandler<T> | undefined;
            onBeforeInput?: FormEventHandler<T> | undefined;
            onInput?: FormEventHandler<T> | undefined;
            onReset?: FormEventHandler<T> | undefined;
            onSubmit?: FormEventHandler<T> | undefined;
            onInvalid?: FormEventHandler<T> | undefined;

            onLoad?: ReactEventHandler<T> | undefined;
            onError?: ReactEventHandler<T> | undefined;

            onKeyDown?: KeyboardEventHandler<T> | undefined;
            onKeyPress?: KeyboardEventHandler<T> | undefined;
            onKeyUp?: KeyboardEventHandler<T> | undefined;

            onClick?: MouseEventHandler<T> | undefined;
            onContextMenu?: MouseEventHandler<T> | undefined;
            onDoubleClick?: MouseEventHandler<T> | undefined;
            onDrag?: DragEventHandler<T> | undefined;
            onDragEnd?: DragEventHandler<T> | undefined;
            onDragEnter?: DragEventHandler<T> | undefined;
            onDragExit?: DragEventHandler<T> | undefined;
            onDragLeave?: DragEventHandler<T> | undefined;
            onDragOver?: DragEventHandler<T> | undefined;
            onDragStart?: DragEventHandler<T> | undefined;
            onDrop?: DragEventHandler<T> | undefined;
            onMouseDown?: MouseEventHandler<T> | undefined;
            onMouseEnter?: MouseEventHandler<T> | undefined;
            onMouseLeave?: MouseEventHandler<T> | undefined;
            onMouseMove?: MouseEventHandler<T> | undefined;
            onMouseOut?: MouseEventHandler<T> | undefined;
            onMouseOver?: MouseEventHandler<T> | undefined;
            onMouseUp?: MouseEventHandler<T> | undefined;

            onSelect?: ReactEventHandler<T> | undefined;

            onTouchCancel?: TouchEventHandler<T> | undefined;
            onTouchEnd?: TouchEventHandler<T> | undefined;
            onTouchMove?: TouchEventHandler<T> | undefined;
            onTouchStart?: TouchEventHandler<T> | undefined;

            onPointerDown?: PointerEventHandler<T> | undefined;
            onPointerMove?: PointerEventHandler<T> | undefined;
            onPointerUp?: PointerEventHandler<T> | undefined;
            onPointerCancel?: PointerEventHandler<T> | undefined;
            onPointerEnter?: PointerEventHandler<T> | undefined;
            onPointerLeave?: PointerEventHandler<T> | undefined;
            onPointerOver?: PointerEventHandler<T> | undefined;
            onPointerOut?: PointerEventHandler<T> | undefined;

            onScroll?: UIEventHandler<T> | undefined;
            onWheel?: WheelEventHandler<T> | undefined;

            onAnimationStart?: AnimationEventHandler<T> | undefined;
            onAnimationEnd?: AnimationEventHandler<T> | undefined;
            onAnimationIteration?: AnimationEventHandler<T> | undefined;

            onTransitionEnd?: TransitionEventHandler<T> | undefined;
        }

        interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
            accessKey?: string | undefined;
            className?: string | undefined;
            contentEditable?: boolean | "inherit" | undefined;
            contextMenu?: string | undefined;
            dir?: string | undefined;
            draggable?: boolean | undefined;
            hidden?: boolean | undefined;
            id?: string | undefined;
            lang?: string | undefined;
            placeholder?: string | undefined;
            slot?: string | undefined;
            spellCheck?: boolean | undefined;
            style?: CSSProperties | undefined;
            tabIndex?: number | undefined;
            title?: string | undefined;
            translate?: "yes" | "no" | undefined;

            inputMode?:
                | "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search"
                | undefined;
            is?: string | undefined;

            color?: string | undefined;
            itemProp?: string | undefined;
            itemScope?: boolean | undefined;
            itemType?: string | undefined;
            itemID?: string | undefined;
            itemRef?: string | undefined;
            results?: number | undefined;
            security?: string | undefined;
            unselectable?: "on" | "off" | undefined;

            [dataAttr: \`data-\${string}\`]: any;
        }

        type DetailedHTMLProps<E extends HTMLAttributes<T>, T> = ClassAttributes<T> & E;

        interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
            download?: any;
            href?: string | undefined;
            hrefLang?: string | undefined;
            media?: string | undefined;
            ping?: string | undefined;
            rel?: string | undefined;
            target?: string | undefined;
            type?: string | undefined;
            referrerPolicy?: string | undefined;
        }
        interface AreaHTMLAttributes<T> extends HTMLAttributes<T> {
            alt?: string | undefined;
            coords?: string | undefined;
            download?: any;
            href?: string | undefined;
            hrefLang?: string | undefined;
            media?: string | undefined;
            rel?: string | undefined;
            shape?: string | undefined;
            target?: string | undefined;
        }
        interface AudioHTMLAttributes<T> extends MediaHTMLAttributes<T> {}
        interface BaseHTMLAttributes<T> extends HTMLAttributes<T> {
            href?: string | undefined;
            target?: string | undefined;
        }
        interface BlockquoteHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; }
        interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
            autoFocus?: boolean | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            formAction?: string | undefined;
            formEncType?: string | undefined;
            formMethod?: string | undefined;
            formNoValidate?: boolean | undefined;
            formTarget?: string | undefined;
            name?: string | undefined;
            type?: "submit" | "reset" | "button" | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
        }
        interface CanvasHTMLAttributes<T> extends HTMLAttributes<T> {
            height?: number | string | undefined;
            width?: number | string | undefined;
        }
        interface ColHTMLAttributes<T> extends HTMLAttributes<T> { span?: number | undefined; width?: number | string | undefined; }
        interface ColgroupHTMLAttributes<T> extends HTMLAttributes<T> { span?: number | undefined; }
        interface DataHTMLAttributes<T> extends HTMLAttributes<T> { value?: string | ReadonlyArray<string> | number | undefined; }
        interface DetailsHTMLAttributes<T> extends HTMLAttributes<T> { open?: boolean | undefined; onToggle?: ReactEventHandler<T> | undefined; }
        interface DelHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; dateTime?: string | undefined; }
        interface DialogHTMLAttributes<T> extends HTMLAttributes<T> { open?: boolean | undefined; }
        interface EmbedHTMLAttributes<T> extends HTMLAttributes<T> {
            height?: number | string | undefined;
            src?: string | undefined;
            type?: string | undefined;
            width?: number | string | undefined;
        }
        interface FieldsetHTMLAttributes<T> extends HTMLAttributes<T> {
            disabled?: boolean | undefined;
            form?: string | undefined;
            name?: string | undefined;
        }
        interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
            acceptCharset?: string | undefined;
            action?: string | undefined;
            autoComplete?: string | undefined;
            encType?: string | undefined;
            method?: string | undefined;
            name?: string | undefined;
            noValidate?: boolean | undefined;
            target?: string | undefined;
        }
        interface HtmlHTMLAttributes<T> extends HTMLAttributes<T> { manifest?: string | undefined; }
        interface IframeHTMLAttributes<T> extends HTMLAttributes<T> {
            allow?: string | undefined;
            allowFullScreen?: boolean | undefined;
            height?: number | string | undefined;
            loading?: "eager" | "lazy" | undefined;
            name?: string | undefined;
            referrerPolicy?: string | undefined;
            sandbox?: string | undefined;
            src?: string | undefined;
            srcDoc?: string | undefined;
            width?: number | string | undefined;
        }
        interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
            alt?: string | undefined;
            crossOrigin?: "anonymous" | "use-credentials" | "" | undefined;
            decoding?: "async" | "auto" | "sync" | undefined;
            height?: number | string | undefined;
            loading?: "eager" | "lazy" | undefined;
            referrerPolicy?: string | undefined;
            sizes?: string | undefined;
            src?: string | undefined;
            srcSet?: string | undefined;
            useMap?: string | undefined;
            width?: number | string | undefined;
        }
        interface InsHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; dateTime?: string | undefined; }
        interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
            accept?: string | undefined;
            alt?: string | undefined;
            autoComplete?: string | undefined;
            autoFocus?: boolean | undefined;
            capture?: boolean | "user" | "environment" | undefined;
            checked?: boolean | undefined;
            crossOrigin?: string | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            formAction?: string | undefined;
            formEncType?: string | undefined;
            formMethod?: string | undefined;
            formNoValidate?: boolean | undefined;
            formTarget?: string | undefined;
            height?: number | string | undefined;
            list?: string | undefined;
            max?: number | string | undefined;
            maxLength?: number | undefined;
            min?: number | string | undefined;
            minLength?: number | undefined;
            multiple?: boolean | undefined;
            name?: string | undefined;
            pattern?: string | undefined;
            placeholder?: string | undefined;
            readOnly?: boolean | undefined;
            required?: boolean | undefined;
            size?: number | undefined;
            src?: string | undefined;
            step?: number | string | undefined;
            type?: string | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
            width?: number | string | undefined;
            onChange?: ChangeEventHandler<T> | undefined;
        }
        interface KeygenHTMLAttributes<T> extends HTMLAttributes<T> {
            autoFocus?: boolean | undefined;
            challenge?: string | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            keyType?: string | undefined;
            keyParams?: string | undefined;
            name?: string | undefined;
        }
        interface LabelHTMLAttributes<T> extends HTMLAttributes<T> {
            form?: string | undefined;
            htmlFor?: string | undefined;
        }
        interface LiHTMLAttributes<T> extends HTMLAttributes<T> { value?: string | ReadonlyArray<string> | number | undefined; }
        interface LinkHTMLAttributes<T> extends HTMLAttributes<T> {
            as?: string | undefined;
            crossOrigin?: string | undefined;
            href?: string | undefined;
            hrefLang?: string | undefined;
            integrity?: string | undefined;
            media?: string | undefined;
            rel?: string | undefined;
            sizes?: string | undefined;
            type?: string | undefined;
        }
        interface MapHTMLAttributes<T> extends HTMLAttributes<T> { name?: string | undefined; }
        interface MenuHTMLAttributes<T> extends HTMLAttributes<T> { type?: string | undefined; }
        interface MediaHTMLAttributes<T> extends HTMLAttributes<T> {
            autoPlay?: boolean | undefined;
            controls?: boolean | undefined;
            controlsList?: string | undefined;
            crossOrigin?: string | undefined;
            loop?: boolean | undefined;
            mediaGroup?: string | undefined;
            muted?: boolean | undefined;
            playsInline?: boolean | undefined;
            preload?: string | undefined;
            src?: string | undefined;
        }
        interface MetaHTMLAttributes<T> extends HTMLAttributes<T> {
            charSet?: string | undefined;
            content?: string | undefined;
            httpEquiv?: string | undefined;
            name?: string | undefined;
        }
        interface MeterHTMLAttributes<T> extends HTMLAttributes<T> {
            form?: string | undefined;
            high?: number | undefined;
            low?: number | undefined;
            max?: number | string | undefined;
            min?: number | string | undefined;
            optimum?: number | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
        }
        interface ObjectHTMLAttributes<T> extends HTMLAttributes<T> {
            classID?: string | undefined;
            data?: string | undefined;
            form?: string | undefined;
            height?: number | string | undefined;
            name?: string | undefined;
            type?: string | undefined;
            useMap?: string | undefined;
            width?: number | string | undefined;
            wmode?: string | undefined;
        }
        interface OlHTMLAttributes<T> extends HTMLAttributes<T> {
            reversed?: boolean | undefined;
            start?: number | undefined;
            type?: "1" | "a" | "A" | "i" | "I" | undefined;
        }
        interface OptgroupHTMLAttributes<T> extends HTMLAttributes<T> { disabled?: boolean | undefined; label?: string | undefined; }
        interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
            disabled?: boolean | undefined;
            label?: string | undefined;
            selected?: boolean | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
        }
        interface OutputHTMLAttributes<T> extends HTMLAttributes<T> {
            form?: string | undefined;
            htmlFor?: string | undefined;
            name?: string | undefined;
        }
        interface ParamHTMLAttributes<T> extends HTMLAttributes<T> { name?: string | undefined; value?: string | ReadonlyArray<string> | number | undefined; }
        interface ProgressHTMLAttributes<T> extends HTMLAttributes<T> { max?: number | string | undefined; value?: string | ReadonlyArray<string> | number | undefined; }
        interface QuoteHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; }
        interface SlotHTMLAttributes<T> extends HTMLAttributes<T> { name?: string | undefined; }
        interface ScriptHTMLAttributes<T> extends HTMLAttributes<T> {
            async?: boolean | undefined;
            crossOrigin?: string | undefined;
            defer?: boolean | undefined;
            integrity?: string | undefined;
            noModule?: boolean | undefined;
            nonce?: string | undefined;
            src?: string | undefined;
            type?: string | undefined;
        }
        interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
            autoComplete?: string | undefined;
            autoFocus?: boolean | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            multiple?: boolean | undefined;
            name?: string | undefined;
            required?: boolean | undefined;
            size?: number | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
            onChange?: ChangeEventHandler<T> | undefined;
        }
        interface SourceHTMLAttributes<T> extends HTMLAttributes<T> {
            media?: string | undefined;
            sizes?: string | undefined;
            src?: string | undefined;
            srcSet?: string | undefined;
            type?: string | undefined;
        }
        interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
            media?: string | undefined;
            nonce?: string | undefined;
            scoped?: boolean | undefined;
            type?: string | undefined;
        }
        interface TableHTMLAttributes<T> extends HTMLAttributes<T> {
            cellPadding?: number | string | undefined;
            cellSpacing?: number | string | undefined;
            summary?: string | undefined;
            width?: number | string | undefined;
        }
        interface TdHTMLAttributes<T> extends HTMLAttributes<T> {
            align?: "left" | "center" | "right" | "justify" | "char" | undefined;
            colSpan?: number | undefined;
            headers?: string | undefined;
            rowSpan?: number | undefined;
            scope?: string | undefined;
            abbr?: string | undefined;
            height?: number | string | undefined;
            width?: number | string | undefined;
            valign?: "top" | "middle" | "bottom" | "baseline" | undefined;
        }
        interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
            autoComplete?: string | undefined;
            autoFocus?: boolean | undefined;
            cols?: number | undefined;
            dirName?: string | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            maxLength?: number | undefined;
            minLength?: number | undefined;
            name?: string | undefined;
            placeholder?: string | undefined;
            readOnly?: boolean | undefined;
            required?: boolean | undefined;
            rows?: number | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
            wrap?: string | undefined;
            onChange?: ChangeEventHandler<T> | undefined;
        }
        interface ThHTMLAttributes<T> extends HTMLAttributes<T> {
            align?: "left" | "center" | "right" | "justify" | "char" | undefined;
            colSpan?: number | undefined;
            headers?: string | undefined;
            rowSpan?: number | undefined;
            scope?: string | undefined;
            abbr?: string | undefined;
        }
        interface TimeHTMLAttributes<T> extends HTMLAttributes<T> { dateTime?: string | undefined; }
        interface TrackHTMLAttributes<T> extends HTMLAttributes<T> {
            default?: boolean | undefined;
            kind?: string | undefined;
            label?: string | undefined;
            src?: string | undefined;
            srcLang?: string | undefined;
        }
        interface VideoHTMLAttributes<T> extends MediaHTMLAttributes<T> {
            height?: number | string | undefined;
            playsInline?: boolean | undefined;
            poster?: string | undefined;
            width?: number | string | undefined;
            disablePictureInPicture?: boolean | undefined;
            disableRemotePlayback?: boolean | undefined;
        }
    }

    namespace ReactDOM {
        /**
         * Mount a React tree into a DOM \`container\`, replacing its
         * children. The React 17-style entry point Bitburner exposes —
         * on React 18+ apps use \`createRoot(container).render(element)\`
         * instead.
         *
         * @example
         *     ReactDOM.render(
         *         React.createElement(App),
         *         document.getElementById("root")
         *     );
         *
         * @see https://legacy.reactjs.org/docs/react-dom.html#render
         */
        function render(
            element: React.ReactElement,
            container: Element | DocumentFragment | null,
            callback?: () => void,
        ): void;
        /**
         * Like \`render\`, but for containers already populated by
         * server-side rendering. React attaches event handlers to the
         * existing markup instead of throwing it away.
         */
        function hydrate(
            element: React.ReactElement,
            container: Element | DocumentFragment | null,
            callback?: () => void,
        ): void;
        /**
         * Tear down a previously-rendered tree and clean up its handlers.
         * Returns \`true\` if there was a tree to remove.
         */
        function unmountComponentAtNode(container: Element | DocumentFragment): boolean;

        /**
         * Return the DOM node backing a class-component instance. Legacy —
         * prefer refs (\`useRef\`, \`forwardRef\`) to talk to the DOM.
         */
        function findDOMNode(instance: React.Component<any, any> | Element | null | undefined): Element | null | Text;

        /**
         * Render \`children\` into a DOM node that isn't a descendant of the
         * current component's parent. Standard escape hatch for modals,
         * tooltips, and dropdowns that need to break out of overflow:hidden
         * or z-index stacking contexts.
         *
         * @example
         *     ReactDOM.createPortal(
         *         React.createElement("div", { className: "toast" }, "saved"),
         *         document.body
         *     );
         *
         * @see https://react.dev/reference/react-dom/createPortal
         */
        function createPortal(
            children: React.ReactNode,
            container: Element | DocumentFragment,
            key?: null | string,
        ): React.ReactPortal;

        /**
         * Force React to flush any pending updates queued inside \`fn\`
         * synchronously, before returning. Escape hatch — using this
         * regularly usually indicates a design problem.
         */
        function flushSync<R>(fn: () => R): R;
        function flushSync<A, R>(fn: (a: A) => R, a: A): R;

        function unstable_batchedUpdates<A, R>(callback: (a: A) => R, a: A): R;
        function unstable_batchedUpdates<R>(callback: () => R): R;

        const version: string;
    }

    // JSX namespace so \`<div />\`, \`<span className="…" />\` etc. resolve in
    // .tsx files. Intrinsic elements are mapped to element-specific
    // attribute bags where they carry weight (input, button, form, …) and
    // to a generic \`HTMLAttributes\` fallback for everything else. The
    // string-index signature at the top makes any unlisted tag still
    // typecheck as an HTML element — practical for the SVG grab-bag and
    // any future HTML additions.
    namespace JSX {
        interface Element extends React.ReactElement<any, any> {}
        interface ElementClass extends React.Component<any> {
            render(): React.ReactNode;
        }
        interface ElementAttributesProperty { props: {}; }
        interface ElementChildrenAttribute { children: {}; }
        interface IntrinsicAttributes extends React.Attributes {}
        interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> {}

        interface IntrinsicElements {
            [tagName: string]: React.DetailedHTMLProps<React.HTMLAttributes<any>, any>;

            a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
            area: React.DetailedHTMLProps<React.AreaHTMLAttributes<HTMLAreaElement>, HTMLAreaElement>;
            audio: React.DetailedHTMLProps<React.AudioHTMLAttributes<HTMLAudioElement>, HTMLAudioElement>;
            base: React.DetailedHTMLProps<React.BaseHTMLAttributes<HTMLBaseElement>, HTMLBaseElement>;
            blockquote: React.DetailedHTMLProps<React.BlockquoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
            button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
            canvas: React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>;
            col: React.DetailedHTMLProps<React.ColHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
            colgroup: React.DetailedHTMLProps<React.ColgroupHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
            data: React.DetailedHTMLProps<React.DataHTMLAttributes<HTMLDataElement>, HTMLDataElement>;
            del: React.DetailedHTMLProps<React.DelHTMLAttributes<HTMLModElement>, HTMLModElement>;
            details: React.DetailedHTMLProps<React.DetailsHTMLAttributes<HTMLDetailsElement>, HTMLDetailsElement>;
            dialog: React.DetailedHTMLProps<React.DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement>;
            div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
            embed: React.DetailedHTMLProps<React.EmbedHTMLAttributes<HTMLEmbedElement>, HTMLEmbedElement>;
            fieldset: React.DetailedHTMLProps<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, HTMLFieldSetElement>;
            form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
            h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            hr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHRElement>, HTMLHRElement>;
            iframe: React.DetailedHTMLProps<React.IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement>;
            img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
            input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
            ins: React.DetailedHTMLProps<React.InsHTMLAttributes<HTMLModElement>, HTMLModElement>;
            label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
            li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
            link: React.DetailedHTMLProps<React.LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;
            map: React.DetailedHTMLProps<React.MapHTMLAttributes<HTMLMapElement>, HTMLMapElement>;
            meta: React.DetailedHTMLProps<React.MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;
            meter: React.DetailedHTMLProps<React.MeterHTMLAttributes<HTMLMeterElement>, HTMLMeterElement>;
            object: React.DetailedHTMLProps<React.ObjectHTMLAttributes<HTMLObjectElement>, HTMLObjectElement>;
            ol: React.DetailedHTMLProps<React.OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>;
            optgroup: React.DetailedHTMLProps<React.OptgroupHTMLAttributes<HTMLOptGroupElement>, HTMLOptGroupElement>;
            option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
            output: React.DetailedHTMLProps<React.OutputHTMLAttributes<HTMLOutputElement>, HTMLOutputElement>;
            param: React.DetailedHTMLProps<React.ParamHTMLAttributes<HTMLParamElement>, HTMLParamElement>;
            progress: React.DetailedHTMLProps<React.ProgressHTMLAttributes<HTMLProgressElement>, HTMLProgressElement>;
            q: React.DetailedHTMLProps<React.QuoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
            script: React.DetailedHTMLProps<React.ScriptHTMLAttributes<HTMLScriptElement>, HTMLScriptElement>;
            select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
            slot: React.DetailedHTMLProps<React.SlotHTMLAttributes<HTMLSlotElement>, HTMLSlotElement>;
            source: React.DetailedHTMLProps<React.SourceHTMLAttributes<HTMLSourceElement>, HTMLSourceElement>;
            style: React.DetailedHTMLProps<React.StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>;
            table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
            td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
            textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
            th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
            time: React.DetailedHTMLProps<React.TimeHTMLAttributes<HTMLTimeElement>, HTMLTimeElement>;
            track: React.DetailedHTMLProps<React.TrackHTMLAttributes<HTMLTrackElement>, HTMLTrackElement>;
            video: React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
        }
    }
`;

// Ambient module re-exports so bare imports (\`import { useState } from
// "react"\`, \`import * as ReactDOM from "react-dom"\`) resolve to the same
// namespaces \`React.…\` / \`ReactDOM.…\` reach. These live at the top-level
// of NetscriptGlobals.d.ts (outside \`declare global\`) — TypeScript
// requires ambient module declarations to be at the top of the file.
export const BUNDLED_REACT_MODULE_ALIASES = `declare module "react" {
    export = React;
}
declare module "react-dom" {
    export = ReactDOM;
}
`;
