/**
 * An Observable is a value that, when updated, will automatically trigger an update
 * in any reactions that are dependent on it.
 */
type Observable = {
    val: any,
    derivations: Set<Derivation>
};

export { Observable };


/**
 * A Derivation can be either a Reaction or a Computed block
 * It is simply defined as being something that depends on Observables and/or Computed values
 */
export class Derivation {

    // If 'derivationEvaluated' is not null, a derivation is currently being evaluated
    static derivationEvaluated: Derivation | null = null;

    protected staleCount = 0;
    private valueChanged = false;

    constructor(protected fn: () => void) {}

    // dependencies: Set<Observable> TODO Observable.derivations are NEVER removed, only more are added.

    /**
     * Mark this derivation as stale. It counts the number of stale notifications it gets in order to
    /* know the number of dependencies it needs to wait on.
    */
    public markStale(): void {
        this.staleCount++;
    }

    public sendReady(valueChanged: boolean): void {
        this.staleCount--;
        this.valueChanged = this.valueChanged || valueChanged;
        if (this.staleCount === 0 && this.valueChanged) { // All dependencies have been updated, we can now trigger this Derivation
            this.evaluate();
            this.valueChanged = false;
        }
    }

    public evaluate(): void {
        Derivation.derivationEvaluated = this;
        this.fn();
        Derivation.derivationEvaluated = null;
    }
}


/**
 * A Computed Derivation also behaves as an Observable as it stores an observable value and needs to
 * keep track of which Derivations are directly dependent on it in order to propagate any 'stale' notifications
 */
export class Computed extends Derivation {
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
