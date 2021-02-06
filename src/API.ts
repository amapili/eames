import type Query from './Query'
import Resource from './Resource'

export default class API extends Map<string, Query.Class | Resource.Class> {
    readonly name: string
    constructor(name: string, entries?: { readonly [k: string]: Query.Class | Resource.Class } | (readonly (readonly [string, Query.Class | Resource.Class])[])) {
        super(entries ? Array.isArray(entries) ? entries : Object.entries(entries) : undefined)
        this.name = name
        this.forEach((query, name) => {
            if (process.env.NODE_ENV === 'development') {
                this.set(name, query)
            }
            query.typeName = name
            query.API = this
        })
    }

    set(name: string, query: Query.Class | Resource.Class): this {
        super.set(name, query)

        if (process.env.NODE_ENV === 'development') {
            if (query.API && query.API.name && query.API !== this)
                throw new Error(`assignment of query "${query.typeName || name}" with existing api ${query.API.name} to api ${this.name}`)
            if (query.typeName && query.typeName !== name)
                throw new Error(`assignment of query "${query.typeName}" to api ${this.name} with name ${name}`)
        }

        query.typeName = name
        query.API = this

        return this
    }
}
