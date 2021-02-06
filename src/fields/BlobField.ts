import SerialError from '../error/SerialError'
import type Serial from '../Serial'
import TupleField from "./TupleField"
import NumberField from "./NumberField"

export default class BlobField implements Serial.Field<Blob> {
    static field = new TupleField([new NumberField(), new NumberField()]);
    serialize(v: Blob, blobs?: Blob[]): number {
        SerialError.assert(blobs !== undefined, 'no blob data')
        blobs.push(v)
        return blobs.length - 1
    }
    deserialize(v: unknown, blobs?:readonly  Blob[]): Blob {
        SerialError.assert(blobs !== undefined, 'no blob data')
        SerialError.assert(typeof v === 'number' && v >= 0 && v < blobs.length, 'expected blob index')
        return blobs[v]
    }
}
