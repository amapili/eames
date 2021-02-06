type FutureState<T> = {
    loading: true
    ok: false
    value?: undefined
} | {
    loading: false
    ok: true
    value: T
} | {
    loading: false
    ok: false
    value: Error
}
type FutureProperties<T> = FutureState<T> & {
    ready: Promise<void>
    read(): T
    map<U>(fn: (v: T) => U): Future<U>
}
type MutableFuture<T> = FutureProperties<T> & Promise<T>

type Future<T> = Readonly<FutureProperties<T>> & Promise<T>

declare module Future {
    export type Now<T extends Future<any>> = ReturnType<T["read"]>
}

function err<T>(error: Error): Future<T> {
    return Object.assign(Promise.reject(error), {
        loading: false,
        ok: false,
        value: error,
        ready: Promise.resolve(),
        map<U>(fn: (v: T) => U) {
            return this as unknown as Future<U>
        },
        read() {
            throw error
        }
    } as FutureProperties<T>)
}

function now<T>(value: T): Future<T> {
    return Object.assign(Promise.resolve(value), {
        loading: false,
        ok: true,
        value,
        ready: Promise.resolve(),
        map<U>(fn: (v: T) => U) {
            try {
                return now(fn(value))
            } catch (e) {
                return err(e)
            }
        },
        read() {
            return value
        }
    } as FutureProperties<T>)
}

type FutureConstructor = (<T>(promise: T | PromiseLike<T>) => Future<T>) & {
    now: typeof now,
    err: typeof err,
}

const Future: FutureConstructor = Object.assign(function <T>(promise: T | PromiseLike<T>): Future<T> {
    const obj: MutableFuture<T> = Object.assign(Promise.resolve(promise), {
        loading: true,
        ok: false,
        map<U>(fn: (v: T) => U) {
            try {
                return obj.ok ? now(fn(obj.value)) : Future(Promise.resolve(obj).then(fn))
            } catch (e) {
                return err(e)
            }
        },
        read() {
            if (!obj.ok)
                throw obj.loading ? obj : obj.value
            return obj.value
        }
    } as FutureProperties<T>)
    obj.ready = obj.then(
        r => {
            obj.loading = false
            obj.ok = true
            obj.value = r
        },
        e => {
            obj.loading = false
            obj.ok = false
            obj.value = e
        }
    )
    return obj
}, { now, err })

export default Future
