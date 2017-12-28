import Derivation from './Derivation';
import Observable from './Observable';


/**
 * A Computed Derivation also behaves as an Observable as it stores an observable value and needs to
 * keep track of which Derivations are directly dependent on it in order to propagate any 'stale' notifications
 */
export default class Computed extends Derivation {
    constructor(public observable: Observable, originalGetter: any) {
        super(() => {
            let oldVal = observable.val;
            this.observable.val = originalGetter();
            for (let derivation of this.observable.derivations) derivation.sendReady(observable.val !== oldVal);
        });
    }

    markStale(): void {
        this.staleCount++;
        for (let derivation of this.observable.derivations) derivation.markStale();
    }
}
