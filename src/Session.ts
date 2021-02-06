import { boolean, optional, string } from './fields'
import Serial, { SerialBase } from './Serial'


export default class Session extends Serial({
    id: string(),
    type: optional(string()),
    long: boolean()
}) {
    private static readonly types = new Map<string, Serial.Class<any, Session>>();
    static add(name: string, s: Serial.Class<any, Session>) {
        Session.types.set(name, ((s as any)._typename = name, s))
    }
    static deserialize(v: unknown) {
        const check = SerialBase.deserialize(v, Session),
            sub = Session.types.get(check.type || '')
        return sub ? SerialBase.deserialize(v, sub) : check
    }

    serialize() {
        return Object.assign(super.serialize(), { type: (this.constructor as any)._typename })
    }
}
