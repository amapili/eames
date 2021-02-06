import SerialError from '../error/SerialError'
import type Serial from '../Serial'

function asDate(s: string) {
    const d = s.split('-')
    SerialError.assert(s.length === 10 && d.length === 3 && s.charAt(4) === '-' && s.charAt(7) === '-', `invalid date string (got ${d})`)
    const year = parseInt(d[0]),
        month = parseInt(d[1]) - 1,
        day = parseInt(d[2])
    SerialError.assert(Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day))

    return new Date(year, month, day)
}

function isDate(d: any): d is Date {
    return !!d.getTime
}

export default class DateField implements Serial.Field<Date> {
    private dayOnly: boolean
    constructor(dayOnly?: boolean) {
        this.dayOnly = !!dayOnly
    }
    serialize(v: Date) {
        return this.dayOnly ? (v.getFullYear() + '-' + (v.getMonth() < 9 ? '0' : '') + (v.getMonth() + 1)
            + '-' + (v.getDate() < 10 ? '0' : '') + v.getDate()) : v.getTime()
    }
    deserialize(v: unknown) {
        let n = Number.NaN
        if (isDate(v))
            n = v.getTime()
        if (this.dayOnly && typeof v === 'string')
            return asDate(v)
        if (typeof v === 'string')
            n = Date.parse(v)
        else if (typeof v === 'number')
            n = v
        SerialError.assert(Number.isInteger(n), `expected date (got ${typeof v})`)
        return new Date(n)
    }
}
