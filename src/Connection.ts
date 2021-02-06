import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import NetworkError from './error/NetworkError'
import NotFoundError from "./error/NotFoundError"
import UnauthorizedError from './error/UnauthorizedError'
import ForbiddenError from './error/ForbiddenError'
import SerialError from './error/SerialError'
import ClientError from './error/ClientError'
import { list, number, tuple, unknown } from './fields'
import API from './API'
import Cookies from './Cookies'

const batchResponse = list(tuple(number(), unknown()))

type Batch = { key: string, q: string, data: string, resolve: (v: { data: any }) => void, reject: (e: any) => void }[]
interface Batches { [api: string]: undefined | { timer: any, queries: Batch } }

export interface Request<T extends { deserialize(v: unknown): any }> {
    key: string
    api: API
    name: string
    data: string
    blobs?: readonly Blob[]
    mutation: boolean
    response: T
}

const defaultConfig = {
    withCredentials: true,
    validateStatus: (s: number) => s >= 200 && s < 300,
    timeout: 30000,
} as const

export default class Connection {
    private readonly inst: AxiosInstance
    cookies = typeof document === 'undefined' ? new Cookies() : new Cookies(document.cookie, s => document.cookie = s[s.length - 1])
    readonly retryDelay = (attempt: number) => Math.pow(2, attempt + 4) * 50
    readonly maxRetries = 4
    readonly maxBatch = 50
    readonly batchTimeout = 10
    readonly url: string
    private readonly cache: { [k: string]: { timer: any, res: any } } = {}

    constructor(conf?: AxiosRequestConfig) {
        this.inst = axios.create({ ...defaultConfig, ...conf })
        this.url = conf?.baseURL || ''
    }

    addCached(req: Request<any>, res: any, ttl = 5 * 1000) {
        const k = req.key
        this.cache[k] = {
            res,
            timer: setTimeout(() => { delete this.cache[k] }, ttl)
        }
    }

    request(conf: AxiosRequestConfig) {
        return this.inst.request(conf)
    }

    private readonly batches: Batches = {}

    private async runBatch(api: API, batch: Batch) {
        for (let i = batch.length - 1; i >= 0; --i) {
            const b = batch[i],
                cached = this.cache[b.key]
            if (!cached)
                continue
            if (cached.timer)
                clearTimeout(cached.timer)
            delete this.cache[b.key]
            b.resolve({ data: cached.res })
        }
        if (batch.length === 0) return
        if (batch.length === 1)
            return this.inst.post(`/api/${api.name}?q=${batch[0].q}`, batch[0].data, {
                headers: {
                    'content-type': 'application/json'
                },
            }).then(batch[0].resolve, batch[0].reject)
        try {
            const res = await this.inst.post(`/api/${api.name}?batch=${batch.length}`, `[${batch.map(({ q, data }) => `[${JSON.stringify(q)},${data}]`).join(',')}]`, {
                headers: {
                    'content-type': 'application/json'
                },
            }), list = batchResponse.deserialize(res.data)
            if (list.size !== batch.length)
                throw new NetworkError('incorrect batch response size')
            list.forEach(([status, data], i) => {
                if (status === 200)
                    batch[i].resolve({ data })
                else
                    batch[i].reject({ response: { status, data } })
            })
        } catch (e) {
            batch.forEach(({ reject }) => reject(e))
        }
    }

    private batch({ api, name: q, data, key, mutation }: Request<any>) {
        return new Promise<{ data: any }>((resolve, reject) => {
            if (this.maxBatch <= 1 || mutation)
                return void this.runBatch(api, [{ key, q, data, resolve, reject }])
            const batch = (this.batches[api.name] ??= { timer: undefined, queries: [] })
            if (batch.timer !== undefined)
                clearTimeout(batch.timer)
            if (batch.queries.length === this.maxBatch) {
                this.runBatch(api, batch.queries)
                batch.queries = []
            }
            batch.queries.push({ key, q, data, resolve, reject })
            batch.timer = setTimeout(() => {
                this.runBatch(api, batch.queries)
                batch.queries = []
                batch.timer = undefined
            }, this.batchTimeout)
            return
        })
    }

    async query<T extends { deserialize(v: unknown): any }>(req: Request<T>) {
        const retry = { current: 0 }
        let lastError: any = undefined
        do {
            if (retry.current)
                await new Promise(r => setTimeout(r, this.retryDelay(retry.current)))
            try {

                const { api, name, data, blobs, response } = req,
                    res = await (() => {
                        if (!blobs?.length)
                            return this.batch(req)
                        const argsBlob = new Blob([data]), arr = [argsBlob].concat(blobs), blob = new Blob(arr)
                        return this.inst.post(`/api/${api.name}?q=${name}`, blob, {
                            headers: {
                                'content-type': 'application/json',
                                'x-sizes': arr.map(b => b.size)
                            },
                        })
                    })()

                return response.deserialize(res.data) as ReturnType<T["deserialize"]>
            } catch (error) {
                lastError = error
                const err = error as AxiosError
                if (err.response) {
                    switch (err.response.status) {
                        case 404: throw new NotFoundError()
                        case 401: throw new UnauthorizedError()
                        case 403: throw new ForbiddenError()
                        case 400: throw new SerialError()
                        case 422:
                            if (typeof err.response.data.code === 'string')
                                throw new ClientError(err.response.data.code)
                    }
                    lastError = new NetworkError('server error: ' + err.response.status)
                    if (err.response.status < 500)
                        throw lastError
                } else if (err.request) {
                    lastError = new NetworkError(err.message)
                } else {
                    throw err
                }
            }

        } while (++retry.current < this.maxRetries)
        throw lastError
    }
}
