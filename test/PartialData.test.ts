import { construct, number, object, string } from "../src/fields"
import PartialData from "../src/PartialData"
import Resource from "../src/Resource"
import Serial from "../src/Serial"

test('partial data', () => {
    const Obj = Serial({ a: number() }),
        Type = Serial({ a: string(), obj: object(Obj) }),
        myobj = new Type({ a: 'test', obj: new Obj({ a: 1 }) }),
        from = PartialData(Type, { a: 'test', obj: { a: 1 } })
    let partial = PartialData(myobj)
    expect(from.serialize()).toEqual(myobj.serialize())
    expect(partial.serialize()).toEqual(myobj.serialize())
    partial = partial.delete('obj')
    expect(partial.serialize()).toEqual({ a: 'test' })
})

test('partial with id', () => {
    const ID = Resource(number(), { a: Serial({}) }),
        Type = Serial({ id: construct(ID) }),
        obj = new Type({ id: new ID('a', 1) }),
        p = PartialData(obj)
    expect(p.serialize()).toEqual({ id: new ID('a', 1).str })
})