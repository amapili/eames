import { DependencyList, useEffect, useState } from 'react'
import Future from './Future'
import Query from './Query'
import Session from "./Session"
import Connection from './Connection'
import DataStore from './DataStore'
import { EventEmitter } from 'events'
import API from './API'
import Resource, { ResourceFuture, ResourceIdentifier } from './Resource'
import Serial from './Serial'
import Mutation from './Mutation'
import { List } from 'immutable'
import { construct } from './fields'

function isResource(q: any): q is Resource.Class {
    return !!q.fieldOfType
}

export default class DataSource implements Resource.TypeProvider {
    readonly connection: Connection
    protected store: DataStore
    private session: Session
    private events = new EventEmitter()
    constructor(cache: Array<[API | undefined, string, object, object]>, con: Connection = new Connection(), session = new Session({ id: '', long: false })) {
        this.connection = con
        this.session = session
        for (const [api, name, argsSerial, dataRaw] of cache) {
            try {
                if (name === '__') {
                    this.session = Session.deserialize(dataRaw)
                    continue
                }
                const q = api?.get(name)
                if (!q) continue
                const args = (isResource(q) ? Serial({ id: construct(q) }) : q).deserialize(argsSerial),
                    req = this.getRequest(isResource(q) ? args.id : args)
                this.connection.addCached(req, dataRaw)
            } catch (e) {
                console.warn(e)
            }
        }
        this.store = new DataStore({ load: this.connection.query.bind(this.connection) })
    }

    useSession() {
        const [session, setSession] = useState(this.session)
        useEffect(() => {
            const l = () => setSession(this.session)
            this.events.on('auth', l)
            return () => { this.events.removeListener('auth', l) }
        }, [])
        return session
    }

    private resourceTypes = new Map<Resource.Class, { [k: string]: Serial | undefined }>()
    getType<R extends Resource.Class, K extends string & keyof R["types"]>(rc: R, type: K) {
        const prev = this.resourceTypes.get(rc),
            map = prev ?? {}
        if (map !== prev)
            this.resourceTypes.set(rc, map)
        return (map[type] ??= rc.types[type]) as Resource.Type<R, K>
    }

    setTypes<R extends Resource.Class, T extends { readonly [K in string & keyof R["types"]]?: Serial.Class }>(rc: R, types: T) {
        const prev = this.resourceTypes.get(rc),
            map = prev ?? {}
        if (map !== prev)
            this.resourceTypes.set(rc, map)
        return Object.assign(map, types)
    }

    clearCache() {
        this.store.clear()
    }

    getSession() {
        return this.session
    }

    setSession(session: Session) {
        this.session = session
        this.events.emit('auth')
    }

    mutate<T extends Mutation<any>>(args: T): Future<Mutation.Result<T>> {
        const update = args.mutationConfig?.update
        return Future(this.store.mutate(this.getRequest(args), update ? ({ get, set, create, delete: del, response }) => {
            update.call(args, args, {
                getType: this.getType.bind(this),
                get: (args: any) => get(this.getRequest(args)),
                set: (args: any, value: any) => set(this.getRequest(args), value),
                create: <R extends Resource>(fakeId: R, value: any, realId?: R) => create(this.getRequest(fakeId), value, realId && this.getRequest(realId)),
                delete: <R extends Resource>(id: R) => del(this.getRequest(id))
            }, response)
        } : undefined))
    }

    getRequest(args: Query | Resource) {
        if (args instanceof ResourceIdentifier)
            return {
                key: `${args.API().name}-${args.typeName()}-${args.str}`,
                api: args.API(),
                name: args.typeName(),
                data: `{"id":"${args.str}"}`,
                mutation: false,
                response: this.getType(args.constructor as any, args.type)
            }
        const blobs = new Array<Blob>()
        return {
            key: args.key(),
            api: args.API(),
            name: args.typeName(),
            data: args.stringify(blobs),
            blobs,
            mutation: args.isMutation(),
            response: args.Response()
        }
    }


    get<T extends Query>(args: T, latest?: boolean): Future<Query.Result<T>>
    get<T extends Resource>(args: T, latest?: boolean): Future<Resource.Result<T>>
    get(args: Query | Resource, latest = true) {
        return this.store.get(this.getRequest(args), latest)
    }

    use<T extends Query>(args: T, deps?: DependencyList): Future<Query.Result<T>>
    use<T extends Resource>(args: T, deps?: DependencyList): Future<Resource.Result<T>>
    use(args: Query | Resource, deps?: DependencyList) {
        const req = this.getRequest(args),
            data = this.store.get(req),
            forceUpdate = useState(0)[1]

        useEffect(() => {
            let valid = true
            const clear = this.store.onChange(req, () => valid && forceUpdate(Date.now()))

            return () => {
                valid = false
                clear()
            }
        }, [req.key])
        useEffect(() => {
            let valid = true
            if (data.loading)
                data.ready.then(() => valid && forceUpdate(Date.now()))
            return () => { valid = false }
        }, [data])

        return data
    }

    subscribe<T extends Query>(args: T, cb: (v: Future<Query.Result<T>>, deleted: boolean) => void): () => void
    subscribe<T extends Resource>(args: T, cb: (v: Future<Resource.Result<T>>, deleted: boolean) => void): () => void
    subscribe(args: any, cb: (v: Future<any>, deleted: boolean) => void) {
        return this.store.onChange(this.getRequest(args), cb)
    }

    useList<R extends Resource>(ids?: Iterable<R>) {
        const [list, setList] = useState(() => List(ids ?? ([] as never)).map(id => Object.assign(this.get(id, false), { id, deleted: false })))
        useEffect(() => {
            setList(List(ids ?? ([] as never)).map(id => Object.assign(this.get(id, false), { id, deleted: false })))
            const subs = List(ids ?? ([] as never)).map((id, i) => this.subscribe(id, (v, deleted) => {
                setList(l => l.set(i, Object.assign(v, { id, deleted })))
            }))
            return () => { subs.forEach(cancel => cancel()) }
        }, [ids])
        return list.filter(v => !v.deleted && (v.loading || v.ok)) as List<ResourceFuture<R>>
    }
}
