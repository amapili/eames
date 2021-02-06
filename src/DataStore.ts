import { Request } from './Connection'
import NotFoundError from './error/NotFoundError'
import Future from './Future'
import Query from './Query'
import Serial from './Serial'

class CacheEntry<T extends Request<Serial.Class> = Request<any>, R extends InstanceType<T["response"]> = InstanceType<T["response"]>> {
    readonly request: T
    private readonly cache: Readonly<CacheState>
    private current: readonly [number, Future<R>]
    private latest: readonly [number, Future<R>]
    private optimistic: readonly [number, Future<R>]
    private opt?: number
    private deleteTimer: any
    private fake: boolean

    private listeners = new Set<(v: Future<R>, deleted: boolean) => void>()

    constructor(request: T, cache: Readonly<CacheState>, value: Future<R>, fake = false) {
        this.request = request
        this.cache = cache
        this.current = this.latest = this.optimistic = [Date.now(), value]
        this.deleteTimer = setTimeout(this.checkDelete, cache.ttl)
        this.fake = fake
    }

    live() {
        return this.fake || (this.opt === this.cache.optimistic && this.optimistic[0] === 0) || (this.latest[0] > this.cache.live && Date.now() - this.latest[0] < this.cache.ttl)
    }

    value(latest = false, allowOptimistic = true) {
        const value = (!this.latest[1].loading || latest) ? this.latest : this.current
        return allowOptimistic && this.opt === this.cache.optimistic && this.optimistic[0] > value[0] ? this.optimistic[1] : value[1]
    }

    update(value: Future<R>) {
        const latest = [Date.now(), value] as const
        this.latest = latest

        if (!value.loading)
            (this.current = this.latest, this.opt = undefined, this.notify())
        else
            value.ready.then(() => {
                if (this.latest === latest) {
                    this.current = latest
                    this.opt = undefined
                    this.notify()
                }
            })
        return this
    }

    addOptimistic(time: number, value: R) {
        this.opt = this.cache.optimistic
        this.optimistic = [time, Future.now(value)]
        return this
    }

    optimisticDelete() {
        this.opt = this.cache.optimistic
        const err = Future.err(new NotFoundError())
        err.catch(() => { })
        this.optimistic = [0, err as any]
        return this
    }

    private checkDelete = () => {
        if (this.listeners.size === 0)
            this.cache.delete(this.request.key)
        this.deleteTimer = undefined
    }

    subscribe(cb: (value: Future<R>, deleted: boolean) => void) {
        this.listeners.add(cb)
        return () => {
            this.listeners.delete(cb)
            if (this.listeners.size)
                return
            if (this.deleteTimer !== undefined)
                clearTimeout(this.deleteTimer)
            this.deleteTimer = setTimeout(this.checkDelete, 50)
        }
    }

    notify() {
        const v = this.value()
        this.listeners.forEach(fn => fn(v, this.opt === this.cache.optimistic && this.optimistic[0] === 0))
    }
}

interface CacheState {
    readonly ttl: number
    delete(key: string): void
    optimistic: number
    live: number
}

type OptimisticFn = (store: { get(args: Request<any>): any, set(args: Request<any>, value: any): void, create(fake: Request<any>, value: any, real?: Request<any>): void, delete(args: Request<any>): void, response?: any }) => void

export default class DataStore {
    private data = new Map<string, CacheEntry>()
    private optimistic = new Set<() => Set<CacheEntry>>()
    private requestQueue = new Array<() => void>()
    private mutationQueue = new Array<() => void>()
    private mutating = false
    private readonly load: (args: Request<any>) => Promise<any>
    private readonly state: CacheState

    constructor({ load, ttl = 30 * 1000 }: { load: DataStore["load"], ttl?: number }) {
        this.load = load
        this.state = { ttl, optimistic: 0, live: 0, delete: this.data.delete.bind(this.data) }
    }

    private async loadValue(args: Request<any>) {
        if (this.mutating)
            await new Promise<void>(r => this.requestQueue.push(r))
        const value = await this.load(args)
        if (this.mutating)
            await new Promise<void>(r => this.requestQueue.push(r))
        return value
    }

    private getEntry(args: Request<any>, latest: boolean) {
        let value = this.data.get(args.key)
        if (value === undefined)
            this.data.set(args.key, value = new CacheEntry(args, this.state, Future(this.loadValue(args))))
        if (latest && !value.live())
            value.update(Future(this.loadValue(args)))
        return value
    }

    get<T extends Request<any>>(args: T, latest?: boolean) {
        if (args.mutation)
            this.state.live = Date.now()
        return this.getEntry(args, true).value(args.mutation || latest)
    }

    clear() {
        this.data.clear()
    }

    async mutate<T extends Request<any>>(args: T, optimistic?: OptimisticFn) {
        if (this.mutating)
            await new Promise<void>(r => this.mutationQueue.push(r))
        this.mutating = true
        const opt = { done: undefined as any as () => Promise<unknown>, result: undefined as any }
        this.state.live = Date.now()

        const ofn = optimistic && this.addOptimistic(optimistic, opt),
            value = Future(this.load(args))

        await value.ready

        if (ofn) {
            opt.result = value.ok ? value.value : undefined
            this.sendUpdates()
        }

        if (this.mutationQueue.length) {
            this.mutationQueue.shift()!()
        } else {
            this.mutating = false
            while (this.requestQueue.length)
                this.requestQueue.shift()!()
        }
        if (ofn) {
            await opt.done()
            this.optimistic.delete(ofn)
        }

        return value
    }

    onChange(args: Request<any>, cb: (o: Future<any>, deleted: boolean) => unknown) {
        const entry = this.getEntry(args, false)
        return entry.subscribe(cb)
    }

    private sendUpdates() {
        this.state.optimistic++
        const evts = new Set<CacheEntry>()
        for (const fn of this.optimistic.values()) {
            fn().forEach(v => evts.add(v))
        }

        for (const entry of evts) {
            entry.notify()
        }
    }

    private addOptimistic(opt: OptimisticFn, inout: { done: () => Promise<unknown>, result?: unknown }) {
        const fetched = new Map<string, Future<Query.Result<Query>>>(),
            time = Date.now()
        inout.done = () => Promise.all(Array.from(fetched.values()).map(a => a.ready)).catch(() => { })
        const fn = () => {
            const ids = new Set<CacheEntry>()
            try {
                opt({
                    get: (args: Request<any>) => {
                        const v = this.data.get(args.key)?.value()
                        return v?.ok ? v.value as any : undefined
                    },
                    set: (args: Request<any>, value: any) => {
                        const d = this.getEntry(args, true)
                        ids.add(d)
                        d.addOptimistic(time, value)
                        if (!fetched.has(args.key)) {
                            fetched.set(args.key, d.value(true, false))
                        }
                    },
                    create: (fake: Request<any>, value: any, real?: Request<any>) => {
                        if (real) {
                            const d = this.getEntry(real, true)
                            ids.add(d)
                            d.addOptimistic(time, value)
                            if (!fetched.has(real.key))
                                fetched.set(real.key, d.value(true, false))
                        } else {
                            const d = new CacheEntry(fake, this.state, Future.now(value), true)
                            this.data.set(fake.key, d)
                            ids.add(d)
                        }
                    },
                    delete: (args: Request<any>) => {
                        const d = this.getEntry(args, false)
                        ids.add(d)
                        d.optimisticDelete()
                    },
                    response: inout.result
                })
            } catch (e) {
                console.warn(e)
            }
            return ids
        }
        this.optimistic = this.optimistic.add(fn)
        this.sendUpdates()
        return fn
    }
}