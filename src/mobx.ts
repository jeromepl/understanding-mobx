// A Derivation can be either a Reaction or a Computed block
type Derivation = {
    fn: () => void,
    // dependencies: Set<Observable> TODO Observable.derivations are NEVER removed, only more are added.
};
type Observable = {
    val: any,
    derivations: Set<Derivation>
};

let inTransaction: boolean = false;
let derivationsDuringTransaction = new Set<Derivation>();
// let derivationDependenciesStack: (string[])[] = [derivationDependencies];

// If 'derivationEvaluated' is not null, a derivation is currently being evaluated
let derivationEvaluated: Derivation | null;

/**
 * Decorator to indicate that a class property is an Observable, thus triggering any Computed values or Reactions
 * whenever the value of this Observable changes.
 * For this demo, this only supports `@observable someProp`. No support for Arrays and Maps.
 */
export function observable(obj: any, prop: string): any {
    const observable = {
        derivations: new Set<Derivation>(),
        val: undefined
    };
    return {
        enumerable: false,
        configurable: true,
        get: () => {
            if (derivationEvaluated) {
                observable.derivations.add(derivationEvaluated);
            }
            return observable.val;
        },
        set: (newVal: any) => {
            const oldVal = observable.val;
            observable.val = newVal;
            if (observable.val !== oldVal) { // Something changed, trigger actions
                triggerDerivations(observable.derivations);
            }
        }
    }
}

// TODO run this in 2 waves. 1 - Send 'stale' notifications to all derivations. The derivations will count the number of stale notifications they get.
// 2 - Send 'ready' notifications when the value was updated (start with Observables) along with whether the value was changed or not.
// Once a derivation receives as many 'ready' as it received 'stale', it recomputes (if at least one value has changed) and then itself sends a 'ready' notification
function triggerDerivations(derivations: Set<Derivation>) {
    if (inTransaction) {
        addSetToSet(derivations, derivationsDuringTransaction);
        return;
    }

    for (let derivation of derivations) {
        // A derivation is always re-evaluated when it is triggered in order to update its Observable dependencies
        evaluateDerivation(derivation);
    }
}

function evaluateDerivation(derivation: Derivation) {
    derivationEvaluated = derivation;
    derivation.fn(); // Run the derivation, while keeping track of what is accessed
    derivationEvaluated = null;

    // derivation.dependencies = new Set(derivationDependencies);
    // derivationDependencies = [];
}

/**
 * The `computed` decorator is really only useful for performance improvements. When using it, the computed value can be cached and
 * only re-computed whenever an observable on which this is dependent changes value. This thus assumes the computed methods are pure.
 * Computed values act as both observables and derivations since they are updated by observables and update
 * In MobX, the value is also garbaged collected if there are no listeners.
 */
export function computed<T>(obj: any, prop: string, descriptor: TypedPropertyDescriptor<T>): any {
    if (!descriptor.get) return descriptor;

    const originalGetter = descriptor.get.bind(obj); // The original getter lives in descriptor.get
    const observable: Observable = {
        val: undefined,
        derivations: new Set<Derivation>()
    }
    const recompute = () => {
        let oldVal = observable.val;
        if (descriptor.get) observable.val = originalGetter();
        if (observable.val !== oldVal) triggerDerivations(observable.derivations);
    };
    const derivation: Derivation = {
        fn: recompute
    };

    evaluateDerivation(derivation); // Initialize

    return {
        enumerable: false,
        configurable: true,
        get: () => {
            if (derivationEvaluated) {
                observable.derivations.add(derivationEvaluated);
            }
            return observable.val;
        }
    };
}

/**
 * Runs the given method 'fn' while keeping track of all affected Reactions.
 * All these Reactions are then triggered once after 'fn' has completed.
 */
export function transaction(fn: () => void) {
    inTransaction = true;
    fn();
    inTransaction = false;

    triggerDerivations(derivationsDuringTransaction);
    derivationsDuringTransaction = new Set<Derivation>();
}

/**
 * Runs the given method whenever an Observable or a Computed value used inside changes value.
 * Evaluates the Observable dependencies at runtime, thus only running when absolutely necessary.
 */
export function autorun(fn: () => void) {
    const reaction = {
        // dependencies: new Set<Observable>(),
        fn
    };
    evaluateDerivation(reaction); // Run it initially. This also allows to figure out the (initial) dependencies of that reaction
}

/** Add the elements in 'set1' to 'set2' */
function addSetToSet<T>(set1: Set<T>, set2: Set<T>): void {
    for (let elementToAdd of set1) set2.add(elementToAdd);
}
