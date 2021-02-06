import { Map } from 'immutable'
jest.mock('../../src/Connection')
import Connection, { Request } from '../../src/Connection'
import NotFoundError from '../../src/error/NotFoundError'
import Query from '../../src/Query'
import Resource, { ResourceIdentifier } from '../../src/Resource'

let responses = Map<string, any>()
const request = Connection as any as jest.Mock


request.mockImplementation(function (this: any) {

    this.query = async (args: Request<any>) => {
        const res = responses.get(args.key)
        if (!res) throw new NotFoundError()

        return res
    }
})

let counter = 0

beforeEach(() => mockRequest.clear())

function getRequest(args: Query | Resource) {
    if (args instanceof ResourceIdentifier)
        return `${args.API().name}-${args.typeName()}-${args.str}`
    else
        return args.key()
}

export const mockRequest = {
    clear() {
        counter = 0
        responses = Map()
    },
    calls() {
        return counter
    },
    response(args: Query | Resource, resp: any) {
        responses = responses.set(getRequest(args), resp as any)
    }
}
